# TODO: custom screen locations loaded off a json file
# TODO: change onMessage to handle multiple types of packets and add audio packets for sound

extends Node

# IJKL UO to move, arrow keys to rotate, . to teleport to you
const canvasOffset = Vector3(-9.95,0,-9.95) # makes the controller hitboxes align with the pixels on the grid
const port = 24897
var moveSpeed = 2 # move speed
var fastSpeed = 4 # shift speed
var rotateSpeed = 1500 # rotation speed
var fastRotateSpeed = 3000 # shift rotation speed

var offset = Vector3(0,-1,0) # account for player height of 1

var controllerHitboxes = [ # .1 units per pixel -> pos (0, -0.05 ,0) would be exactly aligned with the first pixel
	{"pos": Vector3(7.45, 0, 6.65), "rot": Vector3(0, 0, 0), "size": Vector3(.8, .1, 1.8), "key": "UP"},
	{"pos": Vector3(7.45, 0, 9.85), "rot": Vector3(0, 0, 0), "size": Vector3(.8, .1, 1.8), "key": "DOWN"},
	{"pos": Vector3(5.9, 0, 8.25), "rot": Vector3(0, 90, 0), "size": Vector3(.8, .1, 1.8), "key": "LEFT"},
	{"pos": Vector3(9.05, 0, 8.25), "rot": Vector3(0, 90, 0), "size": Vector3(.8, .1, 1.8), "key": "RIGHT"},

	{"pos": Vector3(14.05, 0, 7.75), "rot": Vector3(0, 0, 0), "size": Vector3(1.4, .1, 1.4), "key": "A"},
	{"pos": Vector3(12.15, 0, 9.35), "rot": Vector3(0, 0, 0), "size": Vector3(1.4, .1, 1.4), "key": "B"},

	{"pos": Vector3(8.9, 0, 12.6), "rot": Vector3(0, 45, 0), "size": Vector3(1.9, .1, .4), "key": "SELECT"},
	{"pos": Vector3(10.7, 0, 12.6), "rot": Vector3(0, 45, 0), "size": Vector3(1.9, .1, .4), "key": "START"},

]

var octaveOffsets = [ # half octaves
	-3,
	-3,
	-4
]


# commands for inputs, saving current SRAM to file, emulation speed, button hold time, fully removing the emulator
var validCommands = [
	"u", "up", # up
	"d", "down", # down
	"l", "left", # left
	"r", "right", # right
	"a", # A
	"b", # B
	"select", # Select
	"start", # Start
	"save", # saves sram to file, make sure the actual gameboy game has saved before using (e.g. start menu in pokemon)
	"speed", # sets emulation speed to a supplied integer
	"holdtime", # changes the amount of ticks that inputs are held down for, currently changes both dpad and other buttons
	"abort", # stops the websocket, deletes the screen, sets processing to false. use the trashcan icon in finapse for a "full clear"
	"clear", # clears the screen and controller canvases
	"chalksmod", # chalksmod true/false, enables or disables usage of Chalks colors
	"colorthreshold", # colorthreshold 1000, sets the threshold for closest color distance
	"octave", # octave [channel] 2, shifts by half octave
	"audio", # audio true/false, enables or disables audio
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

var controllerActorID
var controllerActor
var controllerCanvasNode
var controllerTileMap
var controllerImageData


var openStringPitches := [40, 45, 50, 55, 59, 64]
var highestFret := 16

var lastStrum: Array = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]
var stringQueue: Array = [0, 1, 2, 3, 4, 5]
var oldAudioChannelData = { # amplitude, frequency
	1: [0, 0],
	2: [0, 0],
	3: [0, 0]
}

var oldMessages = Network.LOCAL_GAMECHAT_COLLECTIONS.duplicate()


func _ready():
	lp = PlayerAPI.local_player
	var playerPos = lp.global_transform.origin
	var playerZone = lp.current_zone	
	clearProps()
	yield(get_tree().create_timer(0.25),"timeout")
	spawnScreen(playerPos + offset, playerZone)
	spawnController(playerPos + offset, playerZone)
	controllerActor.global_rotation = lp.global_rotation
	startTimers()
	initWebsocket()

func startTimers():
	var screenUpdateTimer = Timer.new()
	add_child(screenUpdateTimer)
	screenUpdateTimer.wait_time = 0.1
	screenUpdateTimer.connect("timeout", self, "posUpdate")

	var controllerUpdateTimer = Timer.new()
	add_child(controllerUpdateTimer)
	controllerUpdateTimer.wait_time = 30
	controllerUpdateTimer.connect("timeout", self, "controllerRefresh")

	screenUpdateTimer.start()
	controllerUpdateTimer.start()

func handleScreenPacket(data):
	var canvasData = []
	for pixelData in data:
		var posX = pixelData[0] + 20 # center horizontally
		var posY = pixelData[1] + 28 # center vertically
		var colorTile = pixelData[2]
		var constructedArray = [
			Vector2(int(posX), int(posY)),
			colorTile
		]
		canvasData.append(constructedArray)
		screenTileMap.set_cell(posX,posY, colorTile)
	updateCanvas(canvasData, screenActorID)

func handleControllerPacket(data):
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
		controllerTileMap.set_cell(posX,posY, colorTile)
	updateCanvas(canvasData, controllerActorID)

func clearDrawings():
	var canvasData = []
	for x in range(0, 200):
		for y in range(0, 200):
			var constructedArray = [
				Vector2(x, y),
				-1
			]
			canvasData.append(constructedArray)
			controllerTileMap.set_cell(x, y, -1)
			screenTileMap.set_cell(x, y, -1)
	updateCanvas(canvasData, controllerActorID)
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

func castRay(from: Vector3, to: Vector3):
	var spaceState = PlayerAPI.local_player.get_world().get_direct_space_state()
	var result = spaceState.intersect_ray(from, to, [])
	if not result:
		return null
	
	if not result.collider:
		return null
		
	return result.position.distance_to(from)

func isJumping(p):
	var rayResult = castRay(p.global_transform.origin, p.global_transform.origin - Vector3(0,100,0))
	
	if not rayResult: return true
	return rayResult >= 1.02

func handleInput(content, sender, args):
	var isSelf = sender == Network.STEAM_USERNAME
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
			if not isSelf: return
			requestSave()
		"speed":
			if not isSelf: return
			#print("set speed to " + args[0])
			setGameSpeed(args[0])
		"holdtime":
			if not isSelf: return
			setHoldTime(args[0])
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
		"octave":
			if not isSelf: return
			var channelNum = int(args[0])
			var shiftAmount = int(args[1])
			octaveOffsets[channelNum - 1] = shiftAmount
			print("set channel " + str(channelNum) + " to " + str(shiftAmount) + " octaves")
		"audio":
			if not isSelf: return
			setAudioToggle(args[0])
			print("enabled audio" if (args[0] == "true" or args[0] == "on") else "disabled audio")


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
	
func controllerRefresh():
	if not controllerImageData: return
	handleControllerPacket(controllerImageData)


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

func spawnController(targetPos, zone):
	var result = createCanvas(targetPos, zone)
	controllerActorID = result["actorID"]
	controllerActor = result["actor"]
	controllerCanvasNode = result["canvasNode"]
	controllerTileMap = result["tileMap"]

	for hitbox in controllerHitboxes:
		createDetectionArea(hitbox["pos"], hitbox["rot"], hitbox["size"], hitbox["key"])

func bringProps():
	if not is_instance_valid(screenActor): return
	screenActor.global_transform.origin = lp.global_transform.origin + offset
	screenActor.global_rotation = Vector3.ZERO
	
	controllerActor.global_transform.origin = lp.global_transform.origin + offset
	controllerActor.global_rotation = lp.global_rotation

func clearProps():
	for node in get_tree().get_nodes_in_group("actor"):
		if not ("canvas" in node.name) and node.controlled: continue
		Network._send_actor_action(node.actor_id, "_wipe_actor", [node.actor_id])
		lp._wipe_actor(node.actor_id)

func createDetectionArea(position: Vector3, rotOffset: Vector3, size: Vector3, keyName: String):
	var area = Area.new()
	area.collision_mask = 8
	area.translation = canvasOffset + position
	area.rotation_degrees = rotOffset
	controllerActor.add_child(area)
	
	var collisionShape = CollisionShape.new()
	var boxShape = BoxShape.new()
	boxShape.extents = size / 2
	collisionShape.shape = boxShape
	area.add_child(collisionShape)
	
	# uncomment to see hitboxes
	#var meshInstance = MeshInstance.new()
	#var cube_mesh = CubeMesh.new()
	#cube_mesh.size = size
	#meshInstance.mesh = cube_mesh
	#area.add_child(meshInstance)
	
	area.connect("body_entered", self, "onBodyEntered", [keyName])
	area.connect("body_exited", self, "onBodyExited", [keyName])

func onBodyEntered(body: Node, key: String):
	if not "player" in body.name.to_lower(): return
	#if isJumping(body): return

	sendKeyDown(key)
	#print("%s pressed %s" % [body.name, key])

func onBodyExited(body: Node, key: String):
	if not "player" in body.name.to_lower(): return
	#if isJumping(body): return

	sendKeyUp(key)
	#print("%s unpressed %s" % [body.name, key])


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

func sendInput(inputstr):
	sendMessage("input|" + inputstr)

func sendKeyDown(key):
	sendMessage("keydown|" + key)

func sendKeyUp(key):
	sendMessage("keyup|" + key)

func requestSave():
	sendMessage("savegame|")
	print("game saved")

func setGameSpeed(gameSpeed):
	sendMessage("setspeed|" + gameSpeed if gameSpeed != "" else "1")

func setHoldTime(holdTime):
	sendMessage("setholdtime|" + holdTime if holdTime != "" else "10")

func setChalkMode(useModded):
	var chalkString = "true" if (useModded == "true" or useModded == "on") else "false"
	sendMessage("setchalkmode|" + chalkString)

func setAudioToggle(audioEnabled):
	var audioString = "true" if (audioEnabled == "true" or audioEnabled == "on") else "false"
	sendMessage("setaudio|" + audioString)

func setColorThreshold(colorThreshold):
	sendMessage("setcolorthreshold|" + colorThreshold if colorThreshold != "" else "4000")



func clientConnected(id, protocol):
	print("client %d connected with protocol: %s" % [id, protocol])
	clients[str(id)] = false
	#sendMessage(id, "Connection confirmed")

func clientDisconnected(id, cleanExit):
	print("client %d disconnected, clean: %s" % [id, str(cleanExit)])
	clients.erase(str(id))

func clientRequestedClose(id, code, reason):
	server.disconnect_peer(id, true)



func isPitchInBounds(pitch: int) -> bool:
	return pitch >= openStringPitches[0] and pitch <= openStringPitches[5] + highestFret

func getPossibleNotes(pitch: int) -> Array:
	var possible_notes := []

	var string: int = 0
	for stringPitch in openStringPitches:
		if pitch >= stringPitch and pitch <= stringPitch + highestFret:
			var fret: int = pitch - stringPitch
			possible_notes.append([string, fret])
		string += 1

	return possible_notes

func getBestNote(notes: Array) -> Array:
	var bestNode: Array
	# starts at the top of the queue
	var leastRecentStringIndex := stringQueue.size() - 1

	for note in notes:
		var string_index = stringQueue.find(note[0])

		if string_index <= leastRecentStringIndex:
			bestNode = note
			leastRecentStringIndex = string_index

	return bestNode

func playNote(note: Array) -> void:
	var string: int = note[0]
	var fret: int = note[1]

	var delta: int = OS.get_system_time_msecs() - lastStrum[string][0]

	if delta < 500 and lastStrum[string][1] != fret:
		PlayerData.emit_signal("_hammer_guitar", string, fret)
	else:
		PlayerData.emit_signal("_play_guitar", string, fret, 1.0)
		lastStrum[string] = [OS.get_system_time_msecs(), fret]

	updateStringQueue(string)

func updateStringQueue(last_played_string: int) -> void:
	var lastStringIndex := stringQueue.find(last_played_string)

	if lastStringIndex != -1:
		stringQueue.pop_at(lastStringIndex)

	stringQueue.append(last_played_string)


func processAudioPacket(packet):
	#print(packet)
	var channelData = { # amplitude, frequency
		1: [packet[0], packet[1] + octaveOffsets[0] * 6], # channel 1
		2: [packet[2], packet[3] + octaveOffsets[1] * 6], # channel 2
		3: [packet[4], packet[5] + octaveOffsets[2] * 6] # channel 3
	}

	for channel in channelData.keys():
		var channelEnabled = channelData[channel][0]
		#print(channelEnabled)
		if not channelEnabled: continue
		var notePitch = channelData[channel][1]
		if notePitch == 0: continue
		
		if oldAudioChannelData[channel] == channelData[channel]: continue
		oldAudioChannelData[channel] = channelData[channel]
		#print(notePitch)
		if !isPitchInBounds(notePitch): 
			continue

		var possible_notes := getPossibleNotes(notePitch)
		var note := getBestNote(possible_notes)
		print(str(notePitch) + ": " + str(note))
		playNote(note)


func packetToPixels(packet):
	var convertedData = []
	for i in range(0, packet.size(), 3):
		var x = packet[i]
		var y = packet[i + 1]
		var color = packet[i + 2]
		convertedData.append([x, y, color])
	return convertedData

func onSocketMessage(id):
	#print("Received data from client: " + str(id))
	var packet = server.get_peer(id).get_packet()
	var decompressedPacket = packet.decompress_dynamic(-1, File.COMPRESSION_DEFLATE)
	var isPixelPacket = decompressedPacket[-1] == 0
	decompressedPacket.remove(len(decompressedPacket) - 1)
	#print(decompressedPacket)
	if isPixelPacket:
		var colorData = packetToPixels(decompressedPacket)
		if clients[str(id)] == false and isPixelPacket:
			clients[str(id)] = true
			#print("received controller image")
			controllerImageData = colorData
			handleControllerPacket(controllerImageData)
			return

		handleScreenPacket(colorData)
	else:
		processAudioPacket(decompressedPacket)