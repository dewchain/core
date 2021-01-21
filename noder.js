const fs = require('fs');
const path = require('path');
var app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const ioc = require("socket.io-client");
const crypto = require('crypto')
const  objhash = require('object-hash');

const g = {
	'addNodes': (fs.readFileSync(path.join(__dirname, 'addnodes.txt'), 'UTF-8')).split('\r').join('').split('\n'),
	'configs': {
		'max_connections': 3,
		'min_connections': process.argv[3],
		'port': process.argv[2]
	},
	'connectedNodes': [],
	'temp_socks': {}
}

let ownIp = '127.0.0.1'

let mempool = {

}

let bcha = [];
let newNodes = []
let cnsi = ''


setInterval(function(){
	bcha = [];
}, 1000*60*60)

async function connect(ip, port){

	return new Promise(function(resolve, reject){
		console.log(`[STATUS] Connecting to: ${ip}:${port}...`)
		let sock = ioc(`http://${ip}:${port}`)
		if(ownIp+':'+g.configs.port !== `${ip}:${port}`){
			cnsi = `${ip}:${port}`

			sock.emit('add_node', {'port': g.configs.port})
			sock.on('connection_success', function(){
				console.log('[STATUS] Connection successful...')
				g.connectedNodes.push({'contact': `${ip}:${port}`, 'rec_sock': sock})

				sock.on('bmsg', function(obj){
					if(!bcha.includes(objhash(obj))){

						broadcast(obj)
						console.log(obj)
					}
				})
				resolve(true)

			})

			sock.on("connection_proxy", function(obj){
				obj.addNodes.map(function(x){
					if(!newNodes.includes(x)){
						newNodes.push(x);
					}
				})
				console.log(`[STATUS] Applied connection proxy...`)

				resolve(false)
			})

			sock.on("connect_error", function(err){
				sock.close()
				cnsi = ''
				console.log(`[STATUS] Connection failed...`)
				resolve(false)
			})
		}else{
			console.log('[ERROR] Rejecting own ip...')
			resolve(false)
		}
	})


	

}

function broadcast(obj){
	if(!bcha.includes(objhash(obj))){
		bcha.push(objhash(obj))
		io.emit('bmsg', obj)
	}
}

function genBroadcast(obj){
	broadcast({'timestamp': Date.now(), 'ip': ownIp + ':' + g.configs.port, 'msg': 'hello!'})
}

async function start(){
	console.log('Running dew node v-1.0.0')
	console.log('>>> Creating connections...')


	http.listen(g.configs.port, async () => {
  		let firstTry = true;
  		while(g.connectedNodes.length < g.configs.min_connections){
  			if(!firstTry){
  				g.addNodes = [];
	  			newNodes.map(function(x){
	  				g.addNodes.push(x)
	  			})

	  			newNodes = []
	  			console.log('[STAUTS] Retrying with new addnodes...')
	  		}else{
	  			firstTry = false;

	  		}
  			if(g.addNodes.length !== 0){
				for (var i = 0; i < g.addNodes.length; i++) {
		    		
		    		await connect(g.addNodes[i].split(':')[0], g.addNodes[i].split(':')[1])
				}
			}else{
				console.log('Unable to connect to any node, starting in isolation mode.')
				break;
			}
		}

		console.log('[GREENLIT] Node connected to MTC network!')

		setInterval(function(){
			genBroadcast()
		}, 1000)
	});


	io.on('connection', function(socket){

		let addr = socket.handshake.address.split(':')[3];
		socket.on('add_node', async function(data){

			if(!(g.connectedNodes.length > g.configs.max_connections)){
				if(cnsi !== `${addr}:${data.port}`){
					await connect(addr, data.port)
					let anl = fs.readFileSync(path.join(__dirname, 'addnodes.txt'), 'UTF-8');
					if(!anl.split('\r').join('').split('\n').includes(`${addr}:${data.port}`)){

						console.log('Adding to addnodes.txt list...')
						anl += `${addr}:${data.port}\n`
						fs.writeFileSync(path.join(__dirname, 'addnodes.txt'), anl)
					}
				}

				socket.emit('connection_success', {'port': g.configs.port})
			}else{
				let nodeList = [];
				g.connectedNodes.map(function(x){
					nodeList.push(x.contact)
				})

				socket.emit('connection_proxy', {'addNodes': nodeList})
			}
		})
		socket.on('access_network', async function(){
			/*
				block_submit
				push_tx
				get_balance
				get_block_info

				get_latest_block
				get_mempool
				get_block
				get_nodes_list


				3GPnF5CpvRE14tF3KboThHzh5ktsjvrppk_3GPnF5CpvRE14tF3KboThHzh5ktsjvrppk_nonce_2198489328498492_0xa4234234234
				0xasdjgajsdguygjg = sha256 => txid
			*/
			socket.emit('access_network_success')
			
			socket.on('api', function(obj){

			})



		})

	})
	
}

start()