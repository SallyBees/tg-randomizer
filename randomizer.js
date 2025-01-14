function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

var role_categories = {};
var case_lookup = {};

function expandCategory(category, found = []) {
	category = case_lookup[category.toUpperCase()];
	found = found.concat(category);
	if(category) {
		if(role_categories[category]) {
			var included_roles = {};
			role_categories[category].map(function(s) {
				if(found.includes(s)) return;
				expandCategory(s, found).map(function(role) {
					included_roles[role] = true;
				});
			});
			return Object.keys(included_roles);
		} else {
			return [category];
		}
	} else {
		return [];
	}
}

$(function() {
	$("#roll-button").click(function() {
		var test_roles = {};
		var coven_roles_enabled = $("#coven-on").prop("checked");
		var tg_ar_roles_enabled = $("#ar-on").prop("checked");
		var tg_vamp_overhaul_roles_enabled = $("#vo-on").prop("checked");
		var tg_florae_roles_enabled = $("#florae-on").prop("checked");
		var faction_limit = $("#faction-limit").val();

		role_categories = $.extend({}, role_meta_categories);
		case_lookup = $.extend({}, case_lookup_base);

		var test_role_names = $("#test-role-names").val().split(/\r\n|\r|\n/);
		var test_role_alignments = $("#test-role-alignments").val().split(/\r\n|\r|\n/);
		var test_role_limits = $("#test-role-limits").val().split(/\r\n|\r|\n/);
		var test_role_weights = $("#test-role-weights").val().split(/\r\n|\r|\n/);
		for(var i = 0; i < test_role_names.length; i++) {
			var line = test_role_names[i].trim();
			if(line == "") continue;
			var name = case_lookup[line.toUpperCase()] || line;

			test_roles[name] = {};
			if(test_role_alignments[i] && test_role_alignments[i].trim()) {
				var category = test_role_alignments[i].trim();
				test_roles[name].category = case_lookup[category.toUpperCase()] || category;
			}
			if(test_role_limits[i] && test_role_limits[i].trim()) {
				var limit = parseInt(test_role_limits[i].trim());
				if(limit >= 0) test_roles[name].limit = limit;
			}
			if(test_role_weights[i] && test_role_weights[i].trim()) {
				var weight = parseFloat(test_role_weights[i].trim());
				if(weight >= 0) test_roles[name].weight = weight;
			}
		}

		var all_roles = $.extend({}, all_roles_base);
		for(var x in test_roles) {
			all_roles[x] = $.extend({limit: 6}, all_roles[x], test_roles[x]);
		}
		for(var x in all_roles) {
			case_lookup[x.toUpperCase()] = x;

			var category = all_roles[x].category;
			if(category) {
				role_categories[category] = (role_categories[category] || []).concat([x]);
			}
		}
		for(var x in role_categories) {
			case_lookup[x.toUpperCase()] = x;
		}

		var rolelist = $("#rolelist").val().split(/\r\n|\r|\n/);
		var rolelist_expanded = rolelist.map(function(line) {
			var parts = line.split(",").map(s=>s.trim()).filter(s=>s);
			var included_roles = {};
			parts.map(function(s) {
				expandCategory(s).map(function(role) {
					included_roles[role] = true;
				});
			});
			for(var role in included_roles) {
				if(typeof test_roles[role] !== 'undefined') {
					// Test roles are included regardless of expansions enabled
					continue;
				}
				if(typeof all_roles[role].coven !== 'undefined' && all_roles[role].coven !== coven_roles_enabled) {
					delete included_roles[role];
				}
				if(typeof all_roles[role].tg_ar !== 'undefined' && all_roles[role].tg_ar !== tg_ar_roles_enabled) {
					delete included_roles[role];
				}
				if(typeof all_roles[role].tg_vamp_overhaul !== 'undefined' && all_roles[role].tg_vamp_overhaul !== tg_vamp_overhaul_roles_enabled) {
					delete included_roles[role];
				}
				if (typeof all_roles[role].tg_florae !== 'undefined' && all_roles[role].tg_florae !== tg_florae_roles_enabled) {
					delete included_roles[role];
				}
			}
			return Object.keys(included_roles);
		}).map(function(list, i) {
			return {
				slot_num: i+1,
				list: list,
			};
		});
		rolelist_expanded = shuffle(rolelist_expanded).sort(function(a, b) {
			return a.list.length - b.list.length;
		});
		var selected_roles = [];
		var restricted_groups = group_restrictions.map(function(entry) {
			var normal_restrictions = [];
			var leaders = [];
			entry.restrictions.map(function(s) {
				if(/^Leader /i.test(s)) {
					leaders.push(s.slice(6).trim());
				} else {
					normal_restrictions.push(s);
				}
			});
			return {
				roles: new Set(entry.grouping.flatMap(s=>expandCategory(s))),
				restrictions: new Set(normal_restrictions.map(s=>s.toLowerCase())),
				leaders: new Set(leaders.flatMap(s=>expandCategory(s))),
			};
		});
		for(var i = 0; i < rolelist_expanded.length; i++) {
			var entry = rolelist_expanded[i];
			var options = entry.list.filter(function(role) {
				var role_limit = all_roles[role].limit;
				if(selected_roles.filter(a=>a === role).length >= role_limit) return false;
				return restricted_groups.every(function(group) {
					if(group.roles.has(role)) {
						if(faction_limit && group.restrictions.has("faction") && selected_roles.filter(a=>group.roles.has(a)).length >= faction_limit) return false;
						if(group.restrictions.has("exclusive") && selected_roles.filter(a=>group.roles.has(a)).length >= 1) return false;
					}
					return true;
				});
			});
			var weights = options.map(function(role) {
				return Number.isFinite(all_roles[role].weight) ? all_roles[role].weight : 1;
			});
			var rand = Math.random()*weights.reduce((a, b) => a + b, 0);
			for(var j = 0; j < options.length; j++) {
				rand -= weights[j];
				if(rand < 0) {
					entry.selected_role = options[j];
					break;
				}
			}

			restricted_groups.map(function(group) {
				if(group.roles.has(entry.selected_role) && group.leaders.size) {
					var has_leader = selected_roles.find(function(role) {
						return group.leaders.has(role);
					}) || group.leaders.has(entry.selected_role);
					var possible_leaders = options.filter(function(role) {
						return group.leaders.has(role);
					});
					if(possible_leaders.length && !has_leader) {
						var weights = possible_leaders.map(function(role) {
							return Number.isFinite(all_roles[role].weight) ? all_roles[role].weight : 1;
						});
						var rand = Math.random()*weights.reduce((a, b) => a + b, 0);
						for(var j = 0; j < possible_leaders.length; j++) {
							rand -= weights[j];
							if(rand < 0) {
								entry.selected_role = possible_leaders[j];
								break;
							}
						}
					}
				}
			})

			if(entry.selected_role) selected_roles.push(entry.selected_role);
		}
		rolelist_expanded = rolelist_expanded.sort(function(a, b) {
			return a.slot_num - b.slot_num;
		});

		var playerlist = $("#playerlist").val().split(/\r\n|\r|\n/).map(s=>s.trim()).filter(s=>s);
		while(playerlist.length < rolelist_expanded.length) {
			playerlist.push("Player "+(playerlist.length+1));
		}
		playerlist = shuffle(playerlist);
		for(var i = 0; i < rolelist_expanded.length; i++) {
			rolelist_expanded[i].player = playerlist[i];
		}
		var results = rolelist_expanded.map(function(entry) {
			return (entry.selected_role || "-") + " (" + entry.player + ")";
		});
		$("#results").val(results.join("\n"));
	});
});
