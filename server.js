const socks = require('socksv5');
const Client = require('ssh2').Client;
const config = require('./config');

let socksServer;
let sshConnection;

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
        })
    });

    log("Connected to SSH: " + config.username + "@" + config.host);

    socksServer = socks.createServer(socksHandler);
    socksServer.listen(config.localPort, "localhost", () => {
        log("Socks5 server started on :" + config.localPort);
    }).useAuth(socks.auth.None());

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

            let clientSocket;
            if (clientSocket = accept(true)) {
                stream.pipe(clientSocket).on("error", err => {
                    log("Failed piping socks socket: " + err.toString());
                }).pipe(stream).on("error", err => {
                    log("Failed piping ssh socket: " + err.toString());

                })
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
    console.log("[" + Date.now() + "]", info);
};

connect();