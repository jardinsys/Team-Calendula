//rawr (prefix only ping command [tr!rawr])
module.exports = {
    name: 'rawr',
    async executeMessage(message, args) {
        await message.reply('RAWR!');
    }
};