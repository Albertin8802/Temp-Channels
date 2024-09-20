const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const prefix = '--';
const tempChannels = new Map();
const userChannels = new Map();
const monitoredVoiceChannelIDs = [
    'xxxxxxxxxxxxxxxx' // establece el id del canal de voz donde se uniran para crear 
];

const bypassRoles = ['xxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxx']; // id de los roles para que no les afecte los comandos como kick lock etc
const maxUserChannels = 2;
const defaultUserLimit = 35;

client.on('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;

    if (newState.channelId && monitoredVoiceChannelIDs.includes(newState.channelId)) {
        const guild = newState.guild;
        const category = newState.channel.parent;

        const userChannelCount = userChannels.get(member.id) || 0;
        if (userChannelCount >= maxUserChannels) {
            return member.send(`Ya has alcanzado el límite de ${maxUserChannels} canales temporales.`);
        }

        const userChannel = await guild.channels.create({
            name: `「👥」Sala de ${member.user.username}`,
            type: 2, 
            parent: category,
            userLimit: defaultUserLimit,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels],
                },
            ],
        });

        member.voice.setChannel(userChannel);

        tempChannels.set(userChannel.id, {
            channel: userChannel,
            timeout: null,
            owner: member.id,
        });

        userChannels.set(member.id, userChannelCount + 1);
    }

    if (oldState.channelId && tempChannels.has(oldState.channelId)) {
        const tempChannelData = tempChannels.get(oldState.channelId);

        if (tempChannelData.channel.members.size === 0) {
            const timeout = setTimeout(() => {
                tempChannelData.channel.delete().catch(console.error);
                tempChannels.delete(oldState.channelId);

                const ownerId = tempChannelData.owner;
                if (userChannels.has(ownerId)) {
                    userChannels.set(ownerId, userChannels.get(ownerId) - 1);
                }
            }, 15000); // si pasado este tiempo no hya nadie en el canal se procedera a borrar el canal temporal

            tempChannelData.timeout = timeout;
        }
    }

    if (newState.channelId && tempChannels.has(newState.channelId)) {
        const tempChannelData = tempChannels.get(newState.channelId);
        if (tempChannelData.timeout) {
            clearTimeout(tempChannelData.timeout);
            tempChannelData.timeout = null;
        }
    }
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const voiceChannel = message.member.voice.channel;

    if (!tempChannels.has(voiceChannel?.id) && !['ayuda', 'comandos'].includes(command)) {
        return message.reply('¡Debes estar en un canal de voz temporal para usar este comando!');
    }

    const hasBypassRole = message.member.roles.cache.some(role => bypassRoles.includes(role.id));

    switch (command) {
        case 'limit':
            if (args.length === 0) {
                return message.reply('Debes proporcionar un número para el límite.');
            }

            const limit = parseInt(args[0]);

            if (isNaN(limit) || limit < 1) {
                return message.reply('Por favor, proporciona un número válido para el límite.');
            }

            try {
                await voiceChannel.setUserLimit(limit);
                message.reply(`El límite de usuarios ha sido establecido en ${limit}.`);
            } catch (error) {
                console.error(error);
                message.reply('Hubo un error al intentar establecer el límite de usuarios.');
            }
            break;

        case 'rename':
            const newName = args.join(' ');
            if (!newName) return message.reply('Debes proporcionar un nuevo nombre para el canal.');
            voiceChannel.setName(newName);
            message.reply(`El canal ha sido renombrado a ${newName}.`);
            break;

        case 'kick':
            const userToKick = message.mentions.members.first();
            if (!userToKick) return message.reply('Menciona a un usuario para expulsar del canal.');

            const userHasBypassRole = userToKick.roles.cache.some(role => bypassRoles.includes(role.id));

            if (userHasBypassRole) {
                return message.reply('No puedes expulsar a este usuario debido a sus roles.');
            }

            if (userToKick.voice.channel && userToKick.voice.channel.id === voiceChannel.id) {
                userToKick.voice.disconnect();
                message.reply(`${userToKick.user.tag} ha sido expulsado del canal.`);
            } else {
                message.reply('Ese usuario no está en tu canal de voz.');
            }
            break;

        case 'lock':
            voiceChannel.permissionOverwrites.edit(message.guild.id, {
                Connect: false
            });
            message.reply('El canal ha sido bloqueado.');
            break;

        case 'unlock':
            voiceChannel.permissionOverwrites.edit(message.guild.id, {
                Connect: true
            });
            message.reply('El canal ha sido desbloqueado.');
            break;

        case 'add':
            const userToAdd = message.mentions.members.first();
            if (!userToAdd) return message.reply('Menciona a un usuario para agregar al canal.');
            voiceChannel.permissionOverwrites.edit(userToAdd.id, {
                Connect: true
            });
            message.reply(`${userToAdd.user.tag} ha sido agregado al canal.`);
            break;

case 'comandos':
    const comandosEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Comandos Disponibles')
        .setDescription('Aquí tienes una lista de comandos que puedes utilizar en tu canal de voz temporal.')
        .addFields(
            { name: '**:wrench: --limit <número>**', value: '> Establece el límite de usuarios en tu canal de voz temporal.' },
            { name: '**:pencil2: --rename <nuevo nombre>**', value: '> Renombra tu canal de voz temporal con un nombre personalizado.' },
            { name: '**:no_entry_sign: --kick @usuario**', value: '> Expulsa a un usuario de tu canal de voz. Solo se puede expulsar a aquellos que estén en el mismo canal que tú.' },
            { name: '**:lock: --lock**', value: '> Bloquea el canal de voz para que nadie más pueda unirse. Solo los miembros que ya están en el canal podrán quedarse.' },
            { name: '**:unlock: --unlock**', value: '> Desbloquea el canal de voz para permitir que más usuarios se unan. ¡Hazlo accesible nuevamente para todos!' },
            { name: '**:heavy_plus_sign: --add @usuario**', value: '> Agrega a un usuario específico a tu canal de voz.' },
            { name: '**:information_source: --ayuda**', value: '> Muestra una lista de funcionalidades y comandos que ofrece el bot.' } // Añadido aquí
        )
        .setFooter({ text: `Fecha: ${new Date().toLocaleDateString()} | by albertin` });

    message.channel.send({ embeds: [comandosEmbed] });
    break;         

    }
});


client.login('TOKEN DE TU BOT');
