SimpleProxy = {
    toggle: async function () {
        const config = await SimpleProxy.getConfig();

        let chromeConfig;
        if (config.enabled) { // Disable the proxy
            chromeConfig = {
                mode: "direct"
            };

            await SimpleProxy.setConfig({
                enabled: false
            })
        } else { // Enable the proxy
            chromeConfig = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "socks5",
                        host: "127.0.0.1",
                        port: 5000
                    },
                    bypassList: ["127.0.0.1", "localhost"]
                }
            };

            await SimpleProxy.setConfig({
                enabled: true
            })
        }

        await new Promise(resolve => {
            chrome.proxy.settings.set({value: chromeConfig, scope: 'regular'}, () => {
                return resolve();
            });
        });

        await SimpleProxy.updateBadge();
    },
    getConfig: async function () {
        return new Promise(resolve => {
            chrome.storage.sync.get(["enabled"], config => {

                if(!config["enabled"]) {
                    const config = {
                        enabled: false
                    };

                    SimpleProxy.setConfig(config).then(() => {
                        return config;
                    });
                }

                return resolve(config);
            });
        });
    },
    setConfig: async function (config) {
        return new Promise(resolve => {
            chrome.storage.sync.set(config, () => {
                return resolve();
            });
        });

    },
    updateBadge: async function () {
        const config = await SimpleProxy.getConfig();

        if(config.enabled) {
            chrome.browserAction.setBadgeText({text: "E"});
            chrome.browserAction.setTitle({title: "Proxy enabled"});
        } else {
            chrome.browserAction.setBadgeText({text: "D"});
            chrome.browserAction.setTitle({title: "Proxy disabled"});
        }
    }
};


SimpleProxy.updateBadge(); // Init the badge
chrome.browserAction.onClicked.addListener(SimpleProxy.toggle);