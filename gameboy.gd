extends Node

# IJKL UO to move, arrow keys to rotate, . to teleport to you
const port = 24893
var speed = 2 # slow enough to move others
var fastSpeed = 4 # faster but slow enough to move self
var rotateSpeed = 25 # rotation speed
var fastRotateSpeed = 100

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
var special = [
	[0,0],
	[199,199],
	[199,0],
	[0,199]
]

var lp

var server
var clients = []

var moveVector = Vector3.ZERO
var rotateVector = Vector3.ZERO
var oldSpeed = speed
var oldRotateSpeed = rotateSpeed

var screenActorID
var screenActor
var canvasNode
var tilemap

var oldMessages = ""

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
	var value = Network.LOCAL_GAMECHAT_COLLECTIONS
	var content = str(value)
	var last_index = content.rfind("]: ")
	if last_index != -1:
		content = content.substr(last_index + 3)
	
	if content != oldMessages:
		oldMessages = content
		if content.length() > 0:
			content = content.substr(0, content.length() - 1)

		var validCommands = ["u", "d", "l", "r", "a", "b", "select", "start"]
		content = content.to_lower()

		if content in validCommands:
			handleInput(content)

	
	
func handleInput(content):
	match content:
		"u":
			sendInput("UP")
		"d":
			sendInput("DOWN")
		"l":
			sendInput("LEFT")
		"r":
			sendInput("RIGHT")
		"a":
			sendInput("A")
		"b":
			sendInput("B")
		"select":
			sendInput("SELECT")
		"start":
			sendInput("START")

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
				speed = fastSpeed
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
				speed = oldSpeed
				rotateSpeed = oldRotateSpeed

func _physics_process(delta):
	moveVector.x = (inputValues["J"] - inputValues["L"]) * delta * speed
	moveVector.y = (inputValues["O"] - inputValues["U"]) * delta * speed
	moveVector.z = (inputValues["I"] - inputValues["K"]) * delta * speed

	rotateVector.y = deg2rad((inputValues["left"] - inputValues["right"]) * delta * rotateSpeed)
	rotateVector.x = deg2rad((inputValues["down"] - inputValues["up"]) * delta * rotateSpeed)


	if (moveVector == Vector3.ZERO and rotateVector == Vector3.ZERO): return
	if lp.busy: return
	
	
	screenActor.global_transform.origin += moveVector
	screenActor.global_rotation += rotateVector

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
	print("ws init")
	server = WebSocketServer.new()
	server.connect("connection_closed", self, "clientDisconnected")
	server.connect("connection_error", self, "clientDisconnected")
	server.connect("connection_established", self, "clientConnected")
	server.connect("data_received", self, "onData")
	
	var err = server.listen(port)
	if err != OK:
		print("Unable to start server")
		set_process(false)
		return
	print("WebSocket Server started on port " + str(port))
	set_process(true)

func sendMessage(message, id=1):
	if server.get_connection_status() == WebSocketClient.CONNECTION_CONNECTED:
		server.get_peer(id).put_packet(message.to_utf8())
		print(message)
	else:
		print("Not connected to server")

func sendInput(inputstr, id = 1):
	server.get_peer(id).put_packet(("input|" + inputstr).to_utf8())

func clientConnected(id, protocol):
		print("Client %d connected with protocol: %s" % [id, protocol])
		clients[id] = true
		#sendMessage(id, "Connection confirmed")

func clientDisconnected(id, was_clean = false):
		print("Client %d disconnected, clean: %s" % [id, str(was_clean)])
		clients.erase(id)

func onData(id = 1):
	#print("Received data from client: ", id)
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
	