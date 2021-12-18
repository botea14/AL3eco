const Discord = require("discord.js"), // npm install discord.js
ms = require("ms"), // npm install ms
Quickdb = require("quick.db"), // npm install Androz2091/quick.db
AsciiTable = require("ascii-table"); // npm install ascii-table

// Replace json.sqlite by the file name of your choice
Quickdb.init("./json.sqlite");

/* Create tables */
const usersData = new Quickdb.Table("usersdata"),
cooldowns = {
    work:new Quickdb.Table("work"),
    rep:new Quickdb.Table("rep"),
    xp:new Quickdb.Table("xp")
};


const config = require("./config.json"), // Load config.json file
functions = require("./functions.js"),
bot = new Discord.Client(); // Create the discord Client

bot.login(config.token); // Discord authentification

bot.on("ready", () => { // When the bot is ready
    bot.user.setActivity(config.game);
    console.log("I am Online !");
    console.log(bot.guilds.size+" servers, "+bot.users.size+" users and "+bot.channels.size+" channels");
});


bot.on("message", (message) => {
        
    // If the message comes from a bot, cancel
    if(message.author.bot || !message.guild){
        return;
    }

    // If the message does not start with the prefix, cancel
    if(!message.content.startsWith(config.prefix)){
        return;
    }

    // Update message mentions
    message.mentions.members = message.mentions.members.filter((m) => !m.user.bot);
    message.member.users = message.mentions.users.filter((u) => !u.bot);

    // If the message content is "/pay @Androz 10", the args will be : [ "pay", "@Androz", "10" ]
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    // The command will be : "pay" and the args : [ "@Androz", "10" ]
    const command = args.shift().toLowerCase();

    // Get the current message author information or create a new default profile
    var authorData = usersData.get(message.author.id) || functions.createUser(message.author, usersData);

    var membersData = []; // Initialize a new empty array

    if(message.mentions.members.size > 0){ // If some members are mentionned
        message.mentions.members.forEach((member) => { // For each member
            // Get the current member information or create a new default profile
            var memberData = usersData.get(member.id) || functions.createUser(member.user, usersData);
            membersData.push(memberData);
        });
    }

    // updates the user data by adding xp
    functions.updateXp(message, authorData, [usersData, cooldowns.xp]);

    // Check if the member is an administrator
    var isAdmin = config.administrators.includes(message.author.id) || config.administrators.includes(message.author.tag);
    
    /* USER COMMANDS */

    switch(command){
        /**
        *  command "help"
        *  Display all the bot commands
        */
        case "help":
            var helpEmbed = new Discord.RichEmbed() // Creates a new rich embed (see https://discord.js.org/#/docs/main/stable/class/RichEmbed)
                .setAuthor("Welcome, "+message.author.username+"#"+message.author.discriminator, message.author.displayAvatarURL)
                .setDescription("**Reminder** : `()` means optional parameter and `[]` mandatory parameter")
                .addField("👨 User Commands", // Sets the title of the field
                    "**"+config.prefix+"profile (@membre)** - View a member's profile!\n"+
                    "**"+config.prefix+"work** - Work and earn credits!\n"+
                    "**"+config.prefix+"rep [@membre]** - Give a reputation point to a member!\n"+
                    "**"+config.prefix+"pay [@membre] [montant]** - Pay a member!\n"+
                    "**"+config.prefix+"leaderboard** - Displays the leaderboard!\n"
                )
                .setColor(config.embed.color) // Sets the color of the embed
                .setFooter(config.embed.footer) // Sets the footer of the embed
                .setTimestamp();

            message.channel.send(helpEmbed); // Send the embed in the current channel
            break;
        
        /**
         *  command "profile"
         *  Display the profile of the message author or the profile of the first mentionned members
        */
        case "profile":
            // Gets the guildMember whose profile you want to display
            var member = message.mentions.members.size > 0 ? message.mentions.members.first() : message.member;

            // Check if the member is a bot
            if(member.user.bot){
                return message.reply("bots don't have a profile !");
            }

            // Gets the data of the guildMember whose profile you want to display
            var data = (message.member === member) ? authorData : membersData[0];
        
            var profileEmbed = new Discord.RichEmbed() // Creates a new rich embed (see https://discord.js.org/#/docs/main/stable/class/RichEmbed)
                .setAuthor("Profile of "+member.user.username+" !", member.user.displayAvatarURL) // Sets the heading of the embed
                // if the member has a description, display them, else display "Aucune description enregistrée !"
                .setDescription(data.desc !== "unknow" ? data.desc : "Internal AL3 Profile")
                // Display the amount of credits of the member
                .addField("💰 Balance", "**"+data.credits+"** AL3 Coins", true)
                // Display the amount of reputation points of the member
                .addField("🎩 Reputation", "**"+data.rep+"** points", true)
                // If the member is premium, display "Oui !" else display "Non..."
                .addField("👑 Premium", ((data.premium === "true") ? "True" : "False"), true)
                // Display the creation date of the member
                .addField("📅 Registration", ""+data.registeredAt, true)
                // Display the level of the member
                .addField("📊 Level", "**"+data.level+"**", true)
                // Display the xp of the member
                .addField("🔮 Experience", "**"+data.xp+"** xp", true)
                .setColor(config.embed.color) // Sets the color of the embed
                .setFooter(config.embed.footer) // Sets the footer of the embed
                .setTimestamp();

            message.channel.send(profileEmbed); // Send the embed in the current channel
            break;

        /**
         *  command "setbio"
         *  Update user biography with the text sent in args
        */
        case "setbio":
            var bio = args.join(" "); // Gets the description 
            // if the member has not entered a description, display an error message
            if(!bio){
                return message.reply("please enter a biography !");
            }
            // if the description is too long, display an error message 
            if(bio.length > 100){
                return message.reply("your biography must not exceed 100 characters !");
            }

            // save the description in the database
            usersData.set(message.author.id+".bio", bio);

            // Send a success message
            message.reply("your description has just been updated !");
            break;

        /**
         *  command "pay"
         *  Send credits to a member
        */
        case "pay":
            // Gets the first mentionned member
            var member = message.mentions.members.first();
            // if doesn't exist, display an error message
            if(!member){
                return message.reply("you must mention a member !");
            }

            // if the user is a bot, cancel
            if(member.user.bot){
                return message.reply("you can't pay a bot !");
            }

            // check if the receiver is the sender
            if(member.id === message.author.id){
                return message.reply("you can't pay yourself !");
            }

            // gets the amount of credits to send
            var amountToPay = args[1];
            // if the member has not entered a valid amount, display an error message
            if(!amountToPay){
                return message.reply("you must enter an amount to be paid to **"+member.user.username+"** !");
            }
            if(isNaN(amountToPay) || amountToPay < 1){
                return message.reply("invalid amount.");
            }
            // if the member does not have enough credits
            if(amountToPay > authorData.credits){
                return message.reply("you do not have enough coins to complete this transaction !");
            }

            // Adding credits to the receiver
            usersData.add(member.id+".credits", amountToPay);
            // Removes credits from the sender
            usersData.subtract(message.author.id+".credits", amountToPay);

            // Send a success message
            message.reply("Transaction completed.");
            break;

        /**
         *  command "work"
         *  Win credits by using work command every six hours
        */
       case "work":

            // if the member is already in the cooldown db
            var isInCooldown = cooldowns.work.get(message.author.id);
            if(isInCooldown){
                /*if the timestamp recorded in the database indicating 
                when the member will be able to execute the order again 
                is greater than the current date, display an error message */
                if(isInCooldown > Date.now()){
                    let delay = functions.convertMs(isInCooldown - Date.now()); 
                    return message.reply("you must wait "+delay+" before you can work again !");
                }
            }
    
            // Records in the database the time when the member will be able to execute the command again (in 6 hours)
            var towait = Date.now() + ms("6h");
            cooldowns.work.set(message.author.id, towait);
            
            // Salary calculation (if the member is premium, the salary is doubled)
            var salary = (authorData.premium === "true") ? 20 : 10;

            // Add "premium" if the member is premium
            var heading = (authorData.premium === "true") ? "Premium salary received !" : "Salary received !";

            var embed = new Discord.RichEmbed() // Creates a new rich embed
                .setAuthor(heading) // sets the heading of the embed
                .setDescription(salary+" AL3 coins added to your profile !")
                .setFooter("For premium members, the salary is doubled !")
                .setColor(config.embed.color) // Sets the color of the embed
                .setTimestamp();
            
            // Update user data
            usersData.add(message.author.id+".credits", salary);

            // Send the embed in the current channel
            message.channel.send(embed);
            break;

        /**
         *  command "rep"
         *  Give a reputation point to a member to thank him
        */
        case "rep":
            // if the member is already in the cooldown db
            var isInCooldown = cooldowns.rep.get(message.author.id);
            if(isInCooldown){
                /*if the timestamp recorded in the database indicating 
                when the member will be able to execute the order again 
                is greater than the current date, display an error message */
                if(isInCooldown > Date.now()){
                    let delay = functions.convertMs(isInCooldown - Date.now()); 
                    return message.reply("you must wait "+delay+" before you can run this command again !");
                }
            }

            // Gets the first mentionned member
            var member = message.mentions.members.first();
            // if doesn't exist, display an error message
            if(!member){
                return message.reply("you must mention a member !");
            }

            // if the user is a bot, cancel
            if(member.user.bot){
                return message.reply("you can't give a bot a reputation point !");
            }

            // if the member tries to give himself a reputation point, dispaly an error message
            if(member.id === message.author.id){
                return message.reply("you can't give yourself a reputation point !");
            }

            // Records in the database the time when the member will be able to execute the command again (in 6 hours)
            var towait = Date.now() + ms("6h");
            cooldowns.rep.set(message.author.id, towait);

            // Update member data 
            usersData.add(member.id+".rep", 1);

            // send a success message in the current channel
            message.reply("you have given a reputation point to **"+member.user.username+"** !");
            break;
        
        /**
         *  command "leaderboard"
         *  Displays the players with the most amount of credits 
        */
        case "leaderboard":
            // Creates a new empty array
            var leaderboard = [];

            // Fetch all users in the database and for each member, create a new object
            usersData.fetchAll().forEach((user) => {
                // if the user data is not an array, parse the user data
                if(typeof user.data !== "object"){
                    user.data = JSON.parse(user.data);
                }
                // Push the user data in the empty array
                leaderboard.push({
                    id:user.ID,
                    credits:user.data.credits,
                    rep:user.data.rep
                });
            });

            // Sort the array by credits
            leaderboard = functions.sortByKey(leaderboard, "credits");
            // Resize the leaderboard
            if(leaderboard.length > 20){
                leaderboard.length = 20;
            }

            // Creates a new ascii table and set the heading
            var table = new AsciiTable("LEADERBOARD").setHeading("", "User", "Balance", "Reputation");

            // Put all users in the new table
            functions.fetchUsers(leaderboard, table, bot).then((newTable) => {
                // Send the table in the current channel
                message.channel.send("```"+newTable.toString()+"```");
            });
            break;

        /* ADMIN COMMANDS */

        /**
         *  command "setcredits"
         *  Sets the amount of credits to the mentionned user
        */

        case "setcredits":
            // if the user is not an administrator
            if(!isAdmin){
                return message.reply("you cannot run this command !");
            }

            // Gets the first mentionned member
            var member = message.mentions.members.first();
            // if doesn't exist, display an error message
            if(!member){
                return message.reply("you must mention a member !");
            }

            // if the user is a bot, cancel
            if(member.user.bot){
                return message.reply("you cannot give credits to a bot !");
            }

            // gets the amount of credits to send
            var toAdd = args[1];
            // if the member has not entered a valid amount, display an error message
            if(isNaN(toAdd) || !toAdd){
                return message.reply("you must enter an amount for **"+member.user.username+"** !");
            }

            // Update user data
            usersData.set(member.id+".credits", parseInt(toAdd, 10));
        
            // Send success message in the current channel
            message.reply("set credits to **"+toAdd+"** for **"+member.user.username+"** !");
            break;
        
        /**
         *  command "premium"
         *  Sets the member premium or not
        */
       case "premium":
        // if the user is not administrator
            if(!isAdmin){
                return message.reply("you cannot run this command !");
            }

            // Gets the first mentionned member
            var member = message.mentions.members.first();
            // if doesn't exist, display an error message
            if(!member){
                return message.reply("you must mention a member !");
            }

            // if the user is a bot, cancel
            if(member.user.bot){
                return message.reply("you cannot pass a premium bot !");
            }

            // If the mentionned member isn"t premium
            if(membersData[0].premium === "false"){
                // Update user data
                usersData.set(member.id+".premium", "true");
                // sends a message of congratulations in the current channel
                message.channel.send(":tada: Congratulation "+member+" ! You are now a premium member !");
            } 
            else { // if the member is premium
                // Update user data
                usersData.set(member.id+".premium", "false");
                // send a message in the current channel
                message.channel.send(":confused: Shame "+member+"... You are no longer a premium member !");
            }
            break;

        /**
         *  command "cooldown"
         *  Reset the cooldown of the member for the command
        */
        case "cooldown":
            // if the user is not administrator
            if(!isAdmin){
                return message.reply("you cannot run this command !");
            }

            // Gets the command 
            var cmd = args[0];
            // if the command is not rep or work or there is no command, display an error message
            if(!cmd || ((cmd !== "rep") && (cmd !== "work"))){
                return message.reply("enter a valid command (rep or work) !");
            }

            // Gets the first mentionned member
            var member = message.mentions.members.first();
            // if doesn't exist, display an error message
            if(!member){
                return message.reply("you must mention a member !");
            }

            // if the user is a bot, cancel
            if(member.user.bot){
                return message.reply("you cannot reset the cooldown of a bot !");
            }

            // Update cooldown db
            cooldowns[cmd].set(member.id, 0);

            // Send a success message
            message.reply("cooldown of **"+member.user.username+"** for using **"+cmd+"** has been set !");
            break;
    }

});
