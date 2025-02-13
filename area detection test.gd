extends Node

func _ready():
	var area = Area.new()
	
	add_child(area)

	var boxMeshInstance = MeshInstance.new()
	var cubeMesh = CubeMesh.new()
	cubeMesh.size = Vector3(2, 2, 2)
	boxMeshInstance.mesh = cubeMesh
	area.add_child(boxMeshInstance)

	var collisionShape = CollisionShape.new()
	var boxShape = BoxShape.new()
	boxShape.extents = cubeMesh.size / 2
	collisionShape.shape = boxShape
	area.add_child(collisionShape)

	area.collision_mask = 8
	area.translation = PlayerAPI.local_player.translation

	area.connect("body_entered", self, "onBodyEntered")
	area.connect("body_exited", self, "onBodyExited")

func onBodyEntered(body):
	print(body.name + " entered")

func onBodyExited(body):
	print(body.name + " exited")