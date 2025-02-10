extends Node

# IJKL UO to move, arrow keys to rotate, . to teleport to you
const port = 24893
var moveSpeed = 2 # move speed
var fastSpeed = 4 # shift speed
var rotateSpeed = 1500 # rotation speed
var fastRotateSpeed = 3000 # shift rotation speed

var offset = Vector3(0,-1,0) # account for player height of 1

var inputValues = {
	"I": 0,
	"K": 0,
	"J": 0,
	"L": 0,
	"U": 0,
	"O": 0,
	"up": 0,
	"down": 0,
	"left": 0,
	"right": 0,
}

var lp

var server
var clients = {}

var moveVector = Vector3.ZERO
var rotateVector = Vector3.ZERO
var oldSpeed = moveSpeed
var oldRotateSpeed = rotateSpeed

var screenActorID
var screenActor
var canvasNode
var tilemap

var oldMessages = Network.LOCAL_GAMECHAT_COLLECTIONS.duplicate()

func _ready():
	lp = PlayerAPI.local_player
	var playerPos = lp.global_transform.origin
	var playerZone = lp.current_zone	
	clearProps()
	yield(get_tree().create_timer(0.25),"timeout")
	spawnScreen(playerPos + offset, playerZone)
	var updateTimer = Timer.new()
	add_child(updateTimer)
	updateTimer.wait_time = 0.1
	updateTimer.connect("timeout", self, "posUpdate")
	updateTimer.start()
	initWebsocket()

func handlePacket(data):
	var canvasData = []
	for pixelData in data:
		var posX = pixelData[0] #+ 19 # center horizontally
		var posY = pixelData[1] #+ 27 # center vertically
		var colorTile = pixelData[2]
		var constructedArray = [
			Vector2(int(posX), int(posY)),
			colorTile
		]
		canvasData.append(constructedArray)
		tilemap.set_cell(posX,posY, colorTile)
	updateCanvas(canvasData)

func updateCanvas(canvasData):
	Network._send_P2P_Packet({"type": "chalk_packet", "data": canvasData, "canvas_id": screenActorID}, "peers", 2, Network.CHANNELS.CHALK)

func logChat():
	var collection = Network.LOCAL_GAMECHAT_COLLECTIONS
	
	if len(collection) == 0: return
	if hash(collection) == hash(oldMessages): return
	
	
	oldMessages = collection.duplicate()
	var newMessage = collection[len(collection)-1]
	var tagSplit = newMessage.split("[/color]")
	if len(tagSplit) < 3: return
	var message = tagSplit[2].to_lower()
	message = message.substr(2)
	var spaceSplit = message.split(" ")
	var command = spaceSplit[0]
	spaceSplit.remove(0)
	var args = spaceSplit
	var sender = tagSplit[1].split("]")[1]
	#OS.clipboard = message

	var validCommands = ["u", "up", "d", "down", "l", "left", "r", "right", "a", "b", "select", "start", "save", "speed"]

	if command in validCommands:
		handleInput(command, sender, args)
	

func handleInput(content, sender, args):
	match content:
		"u":
			sendInput("UP")
		"up":
			sendInput("UP")
		"d":
			sendInput("DOWN")
		"down":
			sendInput("DOWN")
		"l":
			sendInput("LEFT")
		"left":
			sendInput("LEFT")
		"r":
			sendInput("RIGHT")
		"right":
			sendInput("RIGHT")
		"a":
			sendInput("A")
		"b":
			sendInput("B")
		"select":
			sendInput("SELECT")
		"start":
			sendInput("START")
		"save":
			if not sender == Network.STEAM_USERNAME: return
			requestSave()
		"speed":
			if not sender == Network.STEAM_USERNAME: return
			print("speed: " + args[0])
			setGameSpeed(args[0])
		"holdtime":
			if not sender == Network.STEAM_USERNAME: return
			setHoldTime(args[0])	


func _input(event): # this sucks
	if not event is InputEventKey: return
	if event.pressed:
		match event.scancode:
			KEY_I:
				inputValues["I"] = 1
			KEY_K:
				inputValues["K"] = 1
			KEY_J:
				inputValues["J"] = 1
			KEY_L:
				inputValues["L"] = 1
			KEY_U:
				inputValues["U"] = 1
			KEY_O:
				inputValues["O"] = 1
			KEY_UP:
				inputValues["up"] = 1
			KEY_DOWN:
				inputValues["down"] = 1
			KEY_LEFT:
				inputValues["left"] = 1
			KEY_RIGHT:
				inputValues["right"] = 1
			KEY_SHIFT:
				moveSpeed = fastSpeed
				rotateSpeed = fastRotateSpeed

			KEY_PERIOD:
				if not lp.busy:
					bringScreen()
	else:
		match event.scancode:
			KEY_I:
				inputValues["I"] = 0
			KEY_K:
				inputValues["K"] = 0
			KEY_J:
				inputValues["J"] = 0
			KEY_L:
				inputValues["L"] = 0
			KEY_U:
				inputValues["U"] = 0
			KEY_O:
				inputValues["O"] = 0
			KEY_UP:
				inputValues["up"] = 0
			KEY_DOWN:
				inputValues["down"] = 0
			KEY_LEFT:
				inputValues["left"] = 0
			KEY_RIGHT:
				inputValues["right"] = 0
			KEY_SHIFT:
				moveSpeed = oldSpeed
				rotateSpeed = oldRotateSpeed

func _physics_process(delta):
	moveVector.x = (inputValues["J"] - inputValues["L"]) * delta * moveSpeed
	moveVector.y = (inputValues["O"] - inputValues["U"]) * delta * moveSpeed
	moveVector.z = (inputValues["I"] - inputValues["K"]) * delta * moveSpeed

	var yaw = deg2rad((inputValues["left"] - inputValues["right"]) * delta * rotateSpeed)
	var pitch = deg2rad((inputValues["down"] - inputValues["up"]) * delta * rotateSpeed)

	if moveVector == Vector3.ZERO and (yaw == 0 and pitch == 0): return
	if lp.busy: return

	screenActor.global_transform.origin += moveVector
	screenActor.rotate(Vector3.UP, deg2rad(yaw))
	screenActor.rotate_object_local(Vector3.RIGHT, deg2rad(pitch))

func _process(d):
	logChat()
	if not server: return
	if server.is_listening():
		server.poll()

func posUpdate():
	if moveVector == Vector3.ZERO: return
	if lp.busy: return

	Network._send_P2P_Packet({
		"type": "actor_update", 
		"actor_id": screenActorID, 
		"pos": screenActor.global_transform.origin, 
		"rot": screenActor.global_rotation}, 
		"peers", Network.CHANNELS.ACTOR_UPDATE)

func spawnScreen(targetPos, zone):
	screenActorID = Network._sync_create_actor("canvas", targetPos, zone, -1, Network.STEAM_ID, Vector3.ZERO)
	for node in get_tree().get_nodes_in_group("actor"):
		if not is_instance_valid(node): continue
		if not node.actor_id == screenActorID: continue
		screenActor = node
		canvasNode = node.get_node("chalk_canvas")
		tilemap = canvasNode.get_node("Viewport/TileMap")
		#Network.OWNED_ACTORS.append(node)

func bringScreen():
	screenActor.global_transform.origin = lp.global_transform.origin + offset
	screenActor.global_rotation = Vector3.ZERO

func clearProps():
	for node in get_tree().get_nodes_in_group("actor"):
		if not ("canvas" in node.name) and node.controlled: continue
		Network._send_actor_action(node.actor_id, "_wipe_actor", [node.actor_id])
		lp._wipe_actor(node.actor_id)


func initWebsocket():
	#print("ws init")
	server = WebSocketServer.new()
	server.connect("client_disconnected", self, "clientDisconnected")
	server.connect("client_close_request", self, "clientRequestedClose")
	server.connect("client_connected ", self, "clientConnected")
	server.connect("data_received", self, "onMessage")
	
	var err = server.listen(port)
	if err != OK:
		print("unable to start server")
		set_process(false)
		return
	print("websocket started on port " + str(port))
	set_process(true)

func sendMessage(message):
	if server.get_connection_status() != WebSocketClient.CONNECTION_CONNECTED: return
	#print(len(clients))
	for clientID in clients.keys():
		server.get_peer(int(clientID)).put_packet(message.to_utf8())
		print("sent " + message + " to " + str(clientID))

func sendInput(inputstr):
	sendMessage("input|" + inputstr)

func requestSave():
	sendMessage("savegame|")

func setGameSpeed(gameSpeed):
	sendMessage("setspeed|" + gameSpeed if gameSpeed != "" else "1")

func setHoldTime(holdTime)
	sendMessage("setholdtime|" + holdTime if holdTime != "" else "10")



func clientConnected(id, protocol):
	print("client %d connected with protocol: %s" % [id, protocol])
	clients[str(id)] = true
	#sendMessage(id, "Connection confirmed")

func clientDisconnected(id, cleanExit):
	print("client %d disconnected, clean: %s" % [id, str(cleanExit)])
	clients.erase(str(id))

func clientRequestedClose(id, code, reason):
	server.disconnect_peer(id, true)

func onMessage(id):
	#print("Received data from client: ", id)
	clients[str(id)] = true # clientConnected magically stopped being fired
	var packet = server.get_peer(id).get_packet()
	var decompressedPacket = packet.decompress_dynamic(-1, File.COMPRESSION_DEFLATE)
	#print(decompressedPacket)
	var convertedData = []
	for i in range(0, decompressedPacket.size(), 3):
		var x = decompressedPacket[i]
		var y = decompressedPacket[i + 1]
		var color = decompressedPacket[i + 2]
		convertedData.append([x, y, color])
	#print(convertedData)
	#print(packet)
	handlePacket(convertedData)
	