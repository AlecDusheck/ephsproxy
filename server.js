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

    console.log("SSH connection prepped!");

    socksServer = socks.createServer(socksHandler);
    socksServer.listen(config.localPort, 'localhost', () => {
        console.log('Socks5 server started on ' + config.localPort);
    }).useAuth(socks.auth.None());

    socksServer.on("error", err => {
        console.log("Got error in socks5 connection:", err);
    });
};

const socksHandler = async (info, accept, deny) => {
    sshConnection.forwardOut(info.srcAddr,
        info.srcPort,
        info.dstAddr,
        info.dstPort,
        function (err, stream) {
            if (err) {
                sshConnection.end();
                return deny();
            }

            let clientSocket;
            if (clientSocket = accept(true)) {
                stream.pipe(clientSocket).pipe(stream).on('close', function () {
                    sshConnection.end();
                }).on("error", err => {
                    console.log("Testing error:", err);
                })
            } else
                sshConnection.end();
        });
};

const unbind = () => {
    if (socksServer) {
        socksServer.removeAllListeners();
        socksServer = undefined;
    }

    if (sshConnection) {
        sshConnection.removeAllListeners();
        sshConnection = undefined;
    }
};

connect();