extends Node

# IJKL UO to move, arrow keys to rotate, . to teleport to you
const port = 24897
var moveSpeed = 2 # move speed
var fastSpeed = 4 # shift speed
var rotateSpeed = 1500 # rotation speed
var fastRotateSpeed = 3000 # shift rotation speed

var offset = Vector3(0,-1,0) # account for player height of 1

# all commands must be sent in local chat to be used
var validCommands = [
	"abort", # stops the websocket, deletes the screen and script.
	"clear", # clears the screen
	"chalksmod", # chalksmod true/false, enables or disables usage of Chalks colors
	"colorthreshold", # colorthreshold 1000, sets the threshold for closest color distance
	"getpresets", # prints list of saved presets
	"savepreset", # savepreset [name], saves the current screen location
	"loadpreset", # loadpreset [name], loads the screen location
	"deletepreset", # deletepreset [name], deletes the saved preset
]

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
var oldMoveSpeed = moveSpeed
var oldRotateSpeed = rotateSpeed

var screenActorID
var screenActor
var screenCanvasNode
var screenTileMap

var oldMessages = Network.LOCAL_GAMECHAT_COLLECTIONS.duplicate()


func _ready():
	lp = PlayerAPI.local_player
	var playerPos = lp.global_transform.origin
	var playerZone = lp.current_zone	
	clearProps()
	yield(get_tree().create_timer(0.25),"timeout")
	spawnScreen(playerPos + offset, playerZone)
	initWebsocket()

func handleScreenPacket(data):
	var canvasData = []
	for pixelData in data:
		var posX = pixelData[0]
		var posY = pixelData[1]
		var colorTile = pixelData[2]
		var constructedArray = [
			Vector2(int(posX), int(posY)),
			colorTile
		]
		canvasData.append(constructedArray)
		screenTileMap.set_cell(posX,posY, colorTile)
	updateCanvas(canvasData, screenActorID)

func clearDrawings():
	var canvasData = []
	for x in range(0, 200):
		for y in range(0, 200):
			var constructedArray = [
				Vector2(x, y),
				-1
			]
			canvasData.append(constructedArray)
			screenTileMap.set_cell(x, y, -1)
	updateCanvas(canvasData, screenActorID)

func updateCanvas(canvasData, canvasActorID):
	Network._send_P2P_Packet({"type": "chalk_packet", "data": canvasData, "canvas_id": canvasActorID}, "peers", 2, Network.CHANNELS.CHALK)

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

	if command in validCommands:
		handleInput(command, sender, args)


func handleInput(content, sender, args):
	var isSelf = sender == Network.STEAM_USERNAME

	match content:
		"abort":
			if not isSelf: return
			abort()
		"clear":
			if not isSelf: return
			clearDrawings()
		"chalksmod":
			if not isSelf: return
			setChalkMode(args[0])
			print("enabled Chalks colors" if (args[0] == "true" or args[0] == "on") else "disabled Chalks colors")
		"colorthreshold":
			if not isSelf: return
			setColorThreshold(args[0])
		"getpresets":
			if not isSelf: return
			var presets = getCanvasPresetNames()
			if len(presets) == 0: 
				print("no presets saved")
				return
			print("current presets: " + str(getCanvasPresetNames()))
		"savepreset":
			if not isSelf: return
			var presetName = args[0].to_lower()
			saveCanvasPreset(presetName, screenActor.global_transform.origin, screenActor.global_rotation)
			print("saved preset " + args[0])
		"loadpreset":
			if not isSelf: return
			var presetName = args[0].to_lower()
			var presetExists = loadCanvasPreset(presetName)
			if not presetExists: 
				print("preset " + presetName + " does not exist")
				return
			print("loaded preset " + presetName)
		"deletepreset":
			if not isSelf: return
			var presetName = args[0].to_lower()
			var presets = readCanvasPresets()
			if not presetName in presets.keys():
				print("preset " + presetName + " does not exist")
				return
			presets.erase(presetName)
			writeCanvasPresets(presets)
			print("deleted preset " + presetName)


func getCanvasPresetNames():
	var presets = readCanvasPresets()
	var presetNames = []
	for preset in presets.keys():
		presetNames.append(preset)
	return presetNames

func loadCanvasPreset(presetName: String):
	var presets = readCanvasPresets()
	if not presetName in presets.keys(): return false
	var preset = presets[presetName]
	screenActor.global_transform.origin = Vector3(preset["screenPos"][0], preset["screenPos"][1], preset["screenPos"][2])
	screenActor.global_rotation = Vector3(preset["screenRot"][0], preset["screenRot"][1], preset["screenRot"][2])
	return true

func deleteCanvasPreset(presetName: String):
	var presets = readCanvasPresets()
	if not presetName in presets.keys(): return false
	presets.erase(presetName)
	writeCanvasPresets(presets)
	return true

func saveCanvasPreset(presetName: String, screenPos: Vector3, screenRot: Vector3):
	var currentPresets = readCanvasPresets()
	currentPresets[presetName] = {
		"screenPos": [screenPos.x, screenPos.y, screenPos.z],
		"screenRot": [screenRot.x, screenRot.y, screenRot.z],
	}
	
	writeCanvasPresets(currentPresets)

func writeCanvasPresets(canvasPresetData):
	var printFunc = funcref(JSON, "print") # stupid hack to prevent print( from turning into customPrnt( in finapse, curse you godot
	var convertedPresetData = printFunc.call_func(canvasPresetData)
	var file = File.new()
	file.open("user://videoplayer_canvas_presets.json", File.WRITE)
	file.store_string(convertedPresetData)
	file.close()

func readCanvasPresets():
	var file = File.new()
	
	if not file.file_exists("user://videoplayer_canvas_presets.json"): 
		writeCanvasPresets("{}")
		return {}
	file.open("user://videoplayer_canvas_presets.json", File.READ)
	
	var content = file.get_as_text()
	var jsonResult = JSON.parse(content).result
	file.close()

	if not typeof(jsonResult) == TYPE_DICTIONARY: 
		writeCanvasPresets("{}")
		return {}

	return jsonResult


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
					bringProps()
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
				moveSpeed = oldMoveSpeed
				rotateSpeed = oldRotateSpeed

func _physics_process(delta):
	if not is_instance_valid(screenActor): return

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


func createCanvas(targetPos, zone):
	var canvasResult = {}
	canvasResult["actorID"] = Network._sync_create_actor("canvas", targetPos, zone, -1, Network.STEAM_ID, Vector3.ZERO)
	for node in get_tree().get_nodes_in_group("actor"):
		if not is_instance_valid(node): continue
		if not node.actor_id == canvasResult["actorID"]: continue
		canvasResult["actor"] = node
		canvasResult["canvasNode"] = node.get_node("chalk_canvas")
		canvasResult["tileMap"] = canvasResult["canvasNode"].get_node("Viewport/TileMap")
	return canvasResult

func spawnScreen(targetPos, zone):
	var result = createCanvas(targetPos, zone)
	screenActorID = result["actorID"]
	screenActor = result["actor"]
	screenCanvasNode = result["canvasNode"]
	screenTileMap = result["tileMap"]


func bringProps():
	if not is_instance_valid(screenActor): return
	screenActor.global_transform.origin = lp.global_transform.origin + offset
	screenActor.global_rotation = Vector3.ZERO

func clearProps():
	for node in get_tree().get_nodes_in_group("actor"):
		if not ("canvas" in node.name) and node.controlled: continue
		Network._send_actor_action(node.actor_id, "_wipe_actor", [node.actor_id])
		lp._wipe_actor(node.actor_id)


func abort():
	clearProps()
	set_process(false)
	server.stop()
	self.queue_free()
	print("stopped the emulator and backend")

func initWebsocket():
	#print("ws init")
	server = WebSocketServer.new()
	server.connect("client_disconnected", self, "clientDisconnected")
	server.connect("client_close_request", self, "clientRequestedClose")
	server.connect("client_connected", self, "clientConnected")
	server.connect("data_received", self, "onSocketMessage")
	
	var err = server.listen(port)
	if err != OK:
		print("unable to start server")
		set_process(false)
		clearProps()
		queue_free()
		return
	print("websocket started on port " + str(port))
	set_process(true)

func sendMessage(message):
	if server.get_connection_status() != WebSocketClient.CONNECTION_CONNECTED: return
	#print(len(clients))
	for clientID in clients.keys():
		server.get_peer(int(clientID)).put_packet(message.to_utf8())
		#print("sent " + message + " to " + str(clientID))



func setChalkMode(useModded):
	var chalkString = "true" if (useModded == "true" or useModded == "on") else "false"
	sendMessage("setchalkmode|" + chalkString)

func setColorThreshold(colorThreshold):
	sendMessage("setcolorthreshold|" + colorThreshold if colorThreshold != "" else "4000")

func clientConnected(id, protocol):
	print("client %d connected with protocol: %s" % [id, protocol])
	clients[str(id)] = true
	clearDrawings()
	#sendMessage(id, "Connection confirmed")

func clientDisconnected(id, cleanExit):
	print("client %d disconnected, clean: %s" % [id, str(cleanExit)])
	clients.erase(str(id))

func clientRequestedClose(id, code, reason):
	server.disconnect_peer(id, true)


func packetToPixels(packet):
	var convertedData = []
	for i in range(0, packet.size(), 3):
		var x = packet[i]
		var y = packet[i + 1] + 44 # center vertically
		var color = packet[i + 2]
		convertedData.append([x, y, color])
	return convertedData

func onSocketMessage(id):
	#print("Received data from client: " + str(id))
	var packet = server.get_peer(id).get_packet()
	#print(packet)
	var decompressedPacket = packet.decompress_dynamic(-1, File.COMPRESSION_DEFLATE)
	#print(decompressedPacket)
	var colorData = packetToPixels(decompressedPacket)
	handleScreenPacket(colorData)
