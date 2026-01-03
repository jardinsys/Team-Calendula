//hi (prefix only ping command [sys!hi || sys;hi])
module.exports = {
    name: 'hi',
    async executeMessage(message, args) {
        await message.reply('Hi...');
    }
};