const logUpdate = require('log-update');

const clui = require('clui');
const Sparkline = clui.Sparkline;
const Spinner = clui.Spinner;

let alert = "";

const socks = require('socksv5');
const Client = require('ssh2').Client;
const config = require('./config');

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

        log("Connected to SSH: " + config.username + "@" + config.host);

        socksServer = socks.createServer(socksHandler);

        await new Promise(resolve => {
            socksServer.listen(config.localPort, "localhost", () => {
                log("Socks5 server started on :" + config.localPort);
                return resolve();
            }).useAuth(socks.auth.None());
        });

        socksServer.on("error", err => {
            console.log("Got error in socks5 connection:", err);
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
                        log("Failed piping socks socket: " + err.toString());
                    }).pipe(stream).on("error", err => {
                        log("Failed piping ssh socket: " + err.toString());

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
        // console.log("[" + Date.now() + "]", info);
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

    countdown.start();
    await connect();
    countdown.stop();
    startCli();
})();


