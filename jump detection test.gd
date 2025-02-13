extends Node

func _ready():
	set_process(true)

func cast_ray(from: Vector3, to: Vector3):
	var space_state = PlayerAPI.local_player.get_world().get_direct_space_state()
	var result = space_state.intersect_ray(from, to, [])
	if not result:
		return null
	
	if not result.collider:
		return null
		
	return result.position.distance_to(from)

func _process(dt):
	for p in PlayerAPI.players:
		if not is_instance_valid(p): continue
		#if p == PlayerAPI.local_player: continue
		
		var rayResult = cast_ray(p.global_transform.origin, p.global_transform.origin - Vector3(0,100,0))
		
		if rayResult >= 1.02:
			print("JUMP")
		