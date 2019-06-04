const logUpdate = require('log-update');
const readline = require('readline');
const path = require('path');
const fs = require('fs-extra');
const socks = require('socksv5');
const Client = require('ssh2').Client;

const clui = require('clui');
const Sparkline = clui.Sparkline;
const Spinner = clui.Spinner;

let alert = "";
let config;

(async () => {
    let socksServer;
    let sshConnection;

    let totalRequests = 0;
    const lastRequests = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const countdown = new Spinner('Loading SimpleProxy...', ['◜','◠','◝','◞','◡','◟']);

    const connect = async () => {
        unbind(); // Unbind previous connections
        sshConnection = new Client();

        sshConnection.on("error", err => {
            console.log("Got error in SSH connection:", err);
            process.exit(1);
        });

        sshConnection.on("close", () => {
            console.log("SSH connection closed?");
            process.exit(1);
        });

        sshConnection.connect({
            password: config.password,
            username: config.username,
            port: 22,
            host: config.host,
            keepAlive: true
        });

        await new Promise(resolve => {
            sshConnection.on("ready", () => {
                return resolve();
            });
        });

        log("SSH connected: " + config.username + "@" + config.host);

        socksServer = socks.createServer(socksHandler);

        await new Promise(resolve => {
            socksServer.listen(config.localPort, "localhost", () => {
                log("Local proxy started on :" + config.localPort);
                return resolve();
            }).useAuth(socks.auth.None());
        });

        socksServer.on("error", err => {
            console.log("Failed to host local proxy:", err);
            process.exit(1);
        });
    };

    const socksHandler = async (info, accept, deny) => {
        sshConnection.forwardOut(info.srcAddr,
            info.srcPort,
            info.dstAddr,
            info.dstPort,
            (err, stream) => {
                if (err) {
                    return deny();
                }

                totalRequests++;

                let clientSocket;
                if (clientSocket = accept(true)) {
                    stream.pipe(clientSocket).on("error", err => {
                        log("Error in proxy socket: " + err.code);
                    }).pipe(stream).on("error", err => {
                        log("Error in ssh socket: " + err.code);

                    });
                }
            });
    };

    const unbind = () => {
        if (socksServer) {
            socksServer.removeAllListeners();
            socksServer = undefined;
        }

        if (sshConnection) {
            sshConnection.end();
            sshConnection.removeAllListeners();
            sshConnection = undefined;
        }
    };

    const log = (info) => {
        alert = info;
    };

    const startCli = () => {
        process.stdout.write('\n');
        setInterval(() => {
            if (lastRequests.length > 20) lastRequests.shift();

            lastRequests.push(totalRequests);
            totalRequests = 0;

            if(alert === "") {
                logUpdate(Sparkline(lastRequests, "req/sec"));
            } else {
                logUpdate(Sparkline(lastRequests, "req/sec"), "[" + alert + "]");
            }
        }, 1000);
    };

    const loadConfig = async () => {
        const configPath = path.join(__dirname, "config.json");
        try {
            config = await fs.readJson(configPath);
        } catch (e) { // File not found
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // Load defaults
            config = {
                host: "proxy.notalec.com",
                localPort: 5000
            };

            console.log("Assuming default host: " + config.host);

            await new Promise(resolve => {
                rl.question('SimpleProxy username: ', (answer) => {
                    config.username = answer;
                    return resolve();
                });
            });

            await new Promise(resolve => {
                rl.question('SimpleProxy password: ', (answer) => {
                    config.password = answer;
                    return resolve();
                });
            });

            await fs.writeJson(configPath, config);
        }
    };

    await loadConfig();
    countdown.start();
    await connect();
    countdown.stop();
    startCli();
})();


