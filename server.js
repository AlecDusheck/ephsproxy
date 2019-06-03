const socks = require('socksv5');
const Client = require('ssh2').Client;
const config = require('./config');

socks.createServer(function (info, accept, deny) {
    let conn;
    const makeSSH = () => {
        if (conn) conn.removeAllListeners();

        conn = new Client();
        conn.on('ready', function () {
            conn.forwardOut(info.srcAddr,
                info.srcPort,
                info.dstAddr,
                info.dstPort,
                function (err, stream) {
                    if (err) {
                        conn.end();
                        return deny();
                    }

                    let clientSocket;
                    if (clientSocket = accept(true)) {
                        stream.pipe(clientSocket).pipe(stream).on('close', function () {
                            conn.end();
                        })
                    } else
                        conn.end();
                });
        }).on('error', function () {
            console.log("Failed to make socks proxy locally. It is already running?");
            deny();
        }).connect({
            password: config.password,
            username: config.username,
            port: 22,
            host: config.host
        });

        conn.on("error", err => {
            console.log("Caught error:", err);

            setTimeout(() => {
                console.log("Rebuilding connection...");
                makeSSH();
            }, 10000);
        });
    };

    makeSSH();
}).listen(config.localPort, 'localhost', function () {
    console.log('Socks5 server started on ' + config.localPort);
}).useAuth(socks.auth.None());