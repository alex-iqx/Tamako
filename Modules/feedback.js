const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { FEEDBACK_CHANNEL_ID } = require('../Util/constants');

let cachedGuild = null;

async function getGuildInfo(client) {
    if (cachedGuild) return cachedGuild;
    try {
        const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
        cachedGuild = {
            name: channel.guild.name,
            iconURL: channel.guild.iconURL({ dynamic: true, size: 512 })
        };
    } catch {
        cachedGuild = { name: 'Server', iconURL: null };
    }
    return cachedGuild;
}

module.exports = {
    name: 'feedback',

    async handle(message, client) {
        const feedback = (message.content || '').trim();
        if (!FEEDBACK_CHANNEL_ID || !feedback) return;

        const { name: guildName, iconURL: guildIcon } = await getGuildInfo(client);

        const confirmEmbed = new EmbedBuilder()
            .setTitle('Send Feedback')
            .setDescription('Are you sure you want to send this message?')
            .setColor(0xFFFFFF)
            .setThumbnail(guildIcon);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('feedback_confirm')
                .setLabel('Send')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('feedback_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        const prompt = await message.channel.send({
            embeds: [confirmEmbed],
            components: [row]
        }).catch(() => null);

        if (!prompt) return;

        const collector = prompt.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 120_000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            await interaction.update({ components: [] }).catch(() => {});

            if (interaction.customId === 'feedback_confirm') {
                try {
                    const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);
                    if (!channel || !channel.isTextBased()) {
                        await message.channel.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('Unavailable')
                                .setDescription('I cannot send your feedback right now.')
                                .setColor(0xFFFFFF)
                                .setThumbnail(guildIcon)]
                        }).catch(() => {});
                        return;
                    }

                    const now = new Date();
                    const formattedDate = now
                        .toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        .replace(',', '');

                    const finalEmbed = new EmbedBuilder()
                        .setTitle('You have received a feedback!')
                        .setDescription(feedback.slice(0, 4096))
                        .setColor(0xFFFFFF)
                        .setThumbnail(guildIcon)
                        .setFooter({ text: `Devs ❄️ ${guildName} • ${formattedDate}`, iconURL: guildIcon });

                    await channel.send({ embeds: [finalEmbed] }).catch(() => {});

                    await message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('Devs Notified ❄️')
                            .setDescription('Your feedback has been sent successfully. Thank you!')
                            .setColor(0xFFFFFF)
                            .setThumbnail(guildIcon)]
                    }).catch(() => {});
                } catch {
                    await message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('Something Went Wrong')
                            .setDescription('An error occurred while sending your feedback.')
                            .setColor(0xFFFFFF)
                            .setThumbnail(guildIcon)]
                    }).catch(() => {});
                }
            } else {
                await message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('Feedback Cancelled')
                        .setDescription('Feedback sending has been cancelled.')
                        .setColor(0xFFFFFF)
                        .setThumbnail(guildIcon)]
                }).catch(() => {});
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await prompt.edit({ components: [] }).catch(() => {});
                await message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('Request Expired')
                        .setDescription('The confirmation time has expired.')
                        .setColor(0xFFFFFF)
                        .setThumbnail(guildIcon)]
                }).catch(() => {});
            }
        });
    }
};
