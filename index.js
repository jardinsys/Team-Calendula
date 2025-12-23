const config = require("./config.json");
const path = require("path");

// Load environment variables
/*const tokens = {
    prune: config.discordTokens.prune,
    sucre: config.discordTokens.sucre,
    trigin: config.discordTokens.trigin,
    system: config.discordTokens.system
}; */
/*const bots = [
    { path: "./Plum/bot.js", token: tokens.prune, argument: "prune", name: "Prune 🎨" },
    { path: "./Sugar/bot.js", token: tokens.sucre, argument: "sucre", name: "Sucre 💌" },
    { path: "./TigerLily/bot.js", token: tokens.trigin, argument: "trigin", name: "TrigIn 🐯" },
    { path: "./Chameleon/bot.js", token: tokens.system, argument: "system", name: "Systemiser 🎡" }
];*/

const bots = [
    { path: "./Plum/bot.js", argument: "prune", name: "Prune 🎨" },
    { path: "./Sugar/bot.js", argument: "sucre", name: "Sucre 💌" },
    { path: "./TigerLily/bot.js", argument: "trigin", name: "TrigIn 🐯" },
    { path: "./Chameleon/bot.js", argument: "system", name: "Systemiser 🎡" }
];

const arg = process.argv[2];

if (!arg) {
    var AllBotsOnline = true;
    console.log("Launching Discord bots...");
    for (const bot of bots) {
        try {
            console.log(`✔ Starting ${bot.name}`);
            require(path.resolve(bot.path));
        } catch (err) {
            console.error(`❌ Failed to start ${bot.name}`);
            console.error(err);
            AllBotsOnline = false;
        }
    }
    if (AllBotsOnline) { console.log(`All Discord Bots On Deck! 😎👍`) };
    return;
}

const selectedBot = bots.find(b => b.argument === arg);

if (!selectedBot) {
    console.log(`Unknown bot: ${arg}. These are the following available arguments:`);
    for (const bot of bots) { console.log(bot.argument + ", for " + bot.name); }
    return;
}

require(path.resolve(selectedBot.path));
console.log(`✔ Starting ${selectedBot.name}`);