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
    { bot: "./Plum/bot.js", token: tokens.prune, argument: "prune", name: "Prune 🎨" },
    { bot: "./Sugar/bot.js", token: tokens.sucre, argument: "sucre", name: "Sucre 💌" },
    { bot: "./TigerLily/bot.js", token: tokens.trigin, argument: "trigin", name: "TrigIn 🐯" },
    { bot: "./Chameleon/bot.js", token: tokens.system, argument: "system", name: "Systemiser 🎡" }
];*/

const bots = [
    { bot: "./Plum/bot.js", deploy: "./Plum/deploy-command.js", argument: "prune", name: "Prune 🎨" },
    { bot: "./Sugar/bot.js", deploy: "./Sugar/deploy-command.js", argument: "sucre", name: "Sucre 💌" },
    { bot: "./TigerLily/bot.js", deploy: "./TigerLily/deploy-command.js", argument: "trigin", name: "TrigIn 🐯" },
    { bot: "./Chameleon/bot.js", deploy: "./Chameleon/deploy-command.js", argument: "system", name: "Systemiser 🎡" }
];

const args = process.argv.splice(2);
let selectedBots = [];

for (const bot of bots)
    if (args.includes(bot.argument)) selectedBots.push(bot);

// Deployment mode: "-d" in args
if (args.includes("-d")) {
    if (selectedBots.length === 0) {
        let AllBotCommandsDeployed = true;
        console.log("Deploying commands for all Bots...");
        for (const bot of bots) {
            try {
                console.log(`✔ Deploying commands for ${bot.name}`);
                require(path.resolve(bot.deploy));
            } catch (err) {
                console.error(`❌ Failed to deploy commands for ${bot.name}`);
                console.error(err);
                AllBotCommandsDeployed = false;
            }
        }
        if (AllBotCommandsDeployed) console.log("All commands deployed! 🚀");
    } else {
        for (const bot of selectedBots) {
            try {
                console.log(`✔ Deploying commands for ${bot.name}`);
                require(path.resolve(bot.deploy));
            } catch (err) {
                console.error(`❌ Failed to deploy commands for ${bot.name}`);
                console.error(err);
            }
        }
    }
    if (args.includes("-only")) return;
}

if (selectedBots.length === 0) {
    if ((args.length === 1 && !["-d", "-only"].includes(args[0]))
        || (args.length === 2 && args != ["-d", "-only"])
        || args.length > 2) {
        console.log(`Invalid argument(s) detected. These are the following avaulable arguments for to call a specific bot:`);
        for (const bot of bots) console.log(bot.argument + ", for " + bot.name);
        console.log(`You can also include these arguments:
            -d : to also deploy the commands of all or specific bot(s) connected.
            -only : if calling -d too, only deploy the commands and dont start the bot.`);
        return;
    } else {
        let AllBotsOnline = true;
    console.log("Launching Discord bots...");
    for (const bot of bots) {
        try {
            console.log(`✔ Starting ${bot.name}`);
            require(path.resolve(bot.bot));
        } catch (err) {
            console.error(`❌ Failed to start ${bot.name}`);
            console.error(err);
            AllBotsOnline = false;
        }
    }
    if (AllBotsOnline) console.log(`All Discord Bots On Deck! 😎👍`);
    return;
    }
} else { 
    for (const bot of selectedBots) {
        try {
            console.log(`✔ Starting ${bot.name}`);
            require(path.resolve(bot.bot));
        } catch (err) {
            console.error(`❌ Failed to start ${bot.name}`);
            console.error(err);
        }
    }
}