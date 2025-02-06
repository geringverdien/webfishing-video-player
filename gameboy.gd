extends Node

# IJKL UO to move, arrow keys to rotate, . to teleport to you
const targetName = "me" # target or "me"
var speed = 2 # slow enough to move others
var fastSpeed = 4 # faster but slow enough to move self
var rotateSpeed = 1 # rotation speed

var offset = Vector3(0,-1,0) # account for player height of 1
var chairPositions = [
	[Vector3(0,  0, -1), Vector3(0,180,0)], # front
	[Vector3(0,  0, 1), Vector3(0,0,0)], # back
	[Vector3(1,  0, 0), Vector3(0,90,0)], # left
	[Vector3(-1, 0, 0), Vector3(0,-90,0)], # right
	[Vector3(0, 0.2, 0), Vector3(0,0,180)], # bottom
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
var special = [
	[0,0],
	[199,199],
	[199,0],
	[0,199]
]

var moveVector = Vector3.ZERO
var rotateVector = Vector3.ZERO
var props = []
var oldSpeed = speed
var lp
var screenActorID
var screenActor
var canvasNode
var tilemap


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

func _draw():
	var rng = RandomNumberGenerator.new()
	rng.randomize()
	for y in range(200):
		for x in range(200):
			var randint = rng.randi_range(0,5)
			if randint == 5: randint = 6
			tilemap.set_cell(x,y, randint)
	for pos in special:
		tilemap.set_cell(pos[0],pos[1],5) #rainbow corners

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

func _physics_process(delta):
	moveVector.x = (inputValues["J"] - inputValues["L"]) * delta * speed
	moveVector.y = (inputValues["O"] - inputValues["U"]) * delta * speed
	moveVector.z = (inputValues["I"] - inputValues["K"]) * delta * speed

	if moveVector == Vector3.ZERO: return
	if lp.busy: return
	
	moveVector.x = (inputValues["J"] - inputValues["L"]) * delta * speed
	moveVector.y = (inputValues["O"] - inputValues["U"]) * delta * speed
	moveVector.z = (inputValues["I"] - inputValues["K"]) * delta * speed

	for prop in props:
		prop.global_transform.origin += moveVector

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
	screenActorID = Network._sync_create_actor("campfire", targetPos, zone, -1, Network.STEAM_ID, Vector3.ZERO)
	for node in get_tree().get_nodes_in_group("actor"):
		if not node.actor_id == screenActorID: continue
		screenActor = node
		canvasNode = node.get_node("chalk_canvas")
		tilemap = canvasNode.get_node("Viewport/TileMap")
		#Network.OWNED_ACTORS.append(node)

func bringScreen():
	screenActor.global_transform.origin = lp.global_transform.origin + offset
	screenActor.global_rotation = Vector3.ZERO

func spawnChair(pos, rotation, zone):
	var rot = Vector3(deg2rad(rotation.x), deg2rad(rotation.y), deg2rad(rotation.z))
	var chairID = Network._sync_create_actor("chair", pos, zone, -1, Network.STEAM_ID, rot)
	for node in get_tree().get_nodes_in_group("actor"):
		if not node.actor_id == chairID: continue
		props.append(node)
		#Network.OWNED_ACTORS.append(node)

func clearProps():
	for node in get_tree().get_nodes_in_group("actor"):
		if not ("canvas" in node.name) and node.controlled: continue
		Network._send_actor_action(node.actor_id, "_wipe_actor", [node.actor_id])
		lp._wipe_actor(node.actor_id)