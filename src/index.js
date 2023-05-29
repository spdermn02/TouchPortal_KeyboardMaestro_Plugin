const bplist = require('bplist-parser');
const TPClient = new (require("touchportal-api").Client)();
const fs = require('fs');
const open = require('open');

const pluginId = 'TouchPortal_Keyboard_Maestro';
const updateUrl = "https://raw.githubusercontent.com/spdermn02/TouchPortal_Keyboard_Maestro_Plugin/main/package.json";
const releaseUrl = "https://github.com/spdermn02/TouchPortal_KeyboardMaestro_Plugin/releases";

let settings = {};
const PLIST_FILE = process.env.HOME + '/Library/Application Support/Keyboard Maestro/Keyboard Maestro Macros.plist';
const KMTRIGGER_URI = 'kmtrigger://macro=';

let groups = {};
let macros = {};

const readKeyboardMaestroPlist = async () => {
    const plist = await bplist.parseFile(PLIST_FILE);
    
    plist[0]["MacroGroups"].forEach((group,index) => {
        if (group.hasOwnProperty('SearchStrings')) {
            return;
        }
        groups[group.Name] = {'macros':{}};
        let i = 1;
        group.Macros.forEach((macro,idx) => {
            let macroName = `Unknown Macro Name ${i}`;
            i++;
            if( macro.hasOwnProperty('Name')) {
                macroName = macro.Name;
            }
            else if( macro.Actions[0[ && typeof macro.Actions[0] === 'object' ) {
                if( macro.Actions[0].hasOwnProperty("ActionName")) {
                    macroName = macro.Actions[0].ActionName;
                }    
                else if (macro.Actions[0].hasOwnProperty("Title")) {
                    macroName = macro.Actions[0].Title;
                }
                else if (macro.Actions[0].hasOwnProperty("MacroActionType") ) {
                    macroName = macro.Actions[0].MacroActionType;
                }
            }

            macros[macroName] = { 'UID': macro.UID };
            groups[group.Name].macros[macroName] = macros[macroName];
        })
    });

    TPClient.choiceUpdate("keyboard_maestro.states.macro", 
        Object.keys(macros).sort());

};

const getMacroUIDByName = (macroName) => {
    return macros[macroName].UID ?? undefined;
}

TPClient.on("Update", (curVersion, newVersion) => {
  logIt("DEBUG","Update: current version:"+curVersion+" new version:"+newVersion);
  TPClient.sendNotification(`${pluginId}_update_notification`,`Keyboard Maestro Plugin Update Available (${newVersion})`,
    `\nPlease updated to get the latest bug fixes and new features\n\nCurrent Installed Version: ${curVersion}`,
    [{id: `${pluginId}_update_notification_go_to_download`, title: "Go To Download Location" }]
  );
});

TPClient.on("NotificationClicked", (data) => {
  if( data.optionId === `${pluginId}_update_notification_go_to_download`) {
    open(releaseUrl);
  }
});

TPClient.on("Action", (message) => {
    if (message.actionId === "keyboard_maestro.run_macro") {
        const macroName = message.data[0].value;
        const macroUID = getMacroUIDByName(macroName);
        let value = message.data[1].value;
        
        if( macroUID == undefined ) {
            logIt('ERROR',`Macro with name ${macroName} not found for UID`);
            return;
        }

        let callUri = `${KMTRIGGER_URI}${macroUID}`;
        if( value != undefined && value != '' ) {
            callUri = `${callUri}&value=${value}`;
        }
        open(callUri);
    }
});

TPClient.on("Broadcast", () => {
    // Let's not log anything until we actually need to
    // logIt('DEBUG', 'Received Broadcast Message, sending all states again');
});

// Touch Portal Client Setup
TPClient.on("Settings", async (data) => {
    if (data) {
        data.forEach((setting) => {
            let key = Object.keys(setting)[0];
            if (settings[key] === setting[key]) return;
            settings[key] = setting[key];
        });
    }
});

TPClient.on("Info", (data) => {
    //TP Is connected now
    logIt('DEBUG', 'We are connected, received Info message');

    fs.watch(PLIST_FILE, (event, filename) => {
        logIt('DEBUG', `${event} triggerd for ${filename}`);
        if (event === 'change') {
            readKeyboardMaestroPlist();
        }
    });
    readKeyboardMaestroPlist();
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logIt() {
    var curTime = new Date().toISOString();
    var message = [...arguments];
    var type = message.shift();
    console.log(curTime, ":", pluginId, ":" + type + ":", message.join(" "));
}

TPClient.connect({ pluginId, updateUrl });
