//TIME EVENTS
function sepiaFW_build_events(){
	var Events = {};
	
	//some statics
	Events.TIMER = "timer";
	Events.ALARM = "alarm";
	
	var DAY_MS = 24*60*60*1000;
	var HOUR_MS = 60*60*1000;
	var MIN_MS = 60*1000;
	var SEC_MS = 1000;
	
	//about notifications - TODO: unify methods for different types
	var notificationsCurrentId = SepiaFW.data.get('notificationsCurrentId') || 1;
	function getAndIncreaseNotificationId(){
		var newId = notificationsCurrentId++;
		if (newId >= 2147483640) notificationsCurrentId = 0;	//we use Integer.MAX_VALUE since we don't know what android and iOS expect as ids ^^
		SepiaFW.data.set('notificationsCurrentId', notificationsCurrentId);
		return newId;
	}
	var timeEventNotificationIds = SepiaFW.data.get('timeEventNotificationIds') || [];
	var proActiveNotificationIds = SepiaFW.data.get('proActiveNotificationIds') || [];
	function addTimeEventNotificationId(tenId){
		timeEventNotificationIds.push(tenId);
		SepiaFW.data.set('timeEventNotificationIds', timeEventNotificationIds);
	}
	function addProActiveNotificationId(panId){
		proActiveNotificationIds.push(panId);
		SepiaFW.data.set('proActiveNotificationIds', proActiveNotificationIds);
	}
	function getTimeEventNotificationIds(){
		return timeEventNotificationIds;
	}
	function getProActiveNotificationIds(){
		return proActiveNotificationIds;
	}
	function resetTimeEventNotificationIds(){
		var activeTimeEventIds = getTimeEventNotificationIds();
		var checkedActiveTimeEventIds = [];
		//console.log('active Ids (is): ' + activeTimeEventIds); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			cordova.plugins.notification.local.getScheduledIds(function (ids) {
				$.each(ids, function(index, id){
					if ($.inArray(id, activeTimeEventIds) > -1){
						checkedActiveTimeEventIds.push(id);
					}
				});
				timeEventNotificationIds = checkedActiveTimeEventIds;
				SepiaFW.data.set('timeEventNotificationIds', timeEventNotificationIds);
				//console.log('active Ids (new): ' + getTimeEventNotificationIds()); 		//DEBUG
			});
		}
	}
	function resetProActiveNotificationIds(){
		var activeEventIds = getProActiveNotificationIds();
		var checkedActiveEventIds = [];
		//console.log('active Ids (is): ' + activeEventIds); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			cordova.plugins.notification.local.getScheduledIds(function (ids) {
				$.each(ids, function(index, id){
					if ($.inArray(id, activeEventIds) > -1){
						checkedActiveEventIds.push(id);
					}
				});
				proActiveNotificationIds = checkedActiveEventIds;
				SepiaFW.data.set('proActiveNotificationIds', proActiveNotificationIds);
				//console.log('active Ids (new): ' + getProActiveNotificationIds()); 		//DEBUG
			});
		}
	}
	
	//reset all notifications
	Events.resetAllBackgroundEvents = function(resetAllBackgroundEventsCallback){
		//TODO: put these actions in a line and make proper success check
		lastContextualEventsCheck = 0;
		//proActive background notifications
		resetProActiveNotificationIds();
		Events.clearAllProActiveBackgroundNotifications();
		//timeEvent background notifications
		resetTimeEventNotificationIds();
		Events.clearAllTimeEventBackgroundNotifications();
		//report - note: we can just guess here that the OS will do its best to clean up :-#
		if (resetAllBackgroundEventsCallback){
			var success = true; 	//just a guess!
			resetAllBackgroundEventsCallback(success);
		}
	}
	
	//------------- PERSONAL/CONTEXTUAL/PRO-ACTIVE EVENTS (Time-of-day recommendations, ...) --------------
	
	var proActiveMessageTimers = {}; 		//used to schedule non-cordova compatible proActive background notifications and to cancel cordova compatible messages if they are triggered in foreground
	var lastContextualEventsCheck = 0;
	
	Events.loadContextualEvents = function() {
		if (!SepiaFW.assistant.id){
			SepiaFW.debug.err("Events: tried to get events before channel-join completed!");
			return;
		}
		//prevent multiple consecutive calls in short intervall...
		var now = new Date().getTime();
		if ((now - lastContextualEventsCheck) > 10*1000){ 		//interval: 10s
			lastContextualEventsCheck = now;
			//reset Ids tracking proActive background messages
			resetProActiveNotificationIds();
			//clear all old proActive ...
			Events.clearAllProActiveBackgroundNotifications(function(){
				//load contextual events to myView
				var options = {};
					options.skipText = true;
					options.skipTTS = true;
					options.targetView = "myView";
				var dataset = {};	dataset.info = "direct_cmd";
					dataset.cmd = "events_personal;;";
					dataset.newReceiver = SepiaFW.assistant.id;
				SepiaFW.client.sendCommand(dataset, options);
			});
		}
	}
	
	//Background notification 
	Events.setProActiveBackgroundNotification = function(action){
		//console.log('setProActiveBackgroundNotification: ' + action.eventId); 		//DEBUG
		if (!SepiaFW.assistant.isProActive){
			return;
		}
		if (!action || action.triggerIn < 0){
			//timers of the past are rejected
			return;
		}
		/* action:
		{"eventId":"randomMotivationMorning","info":"entertainWhileIdle","triggerIn":-22800000,"text":"Ach, ich wollte noch sagen, du bist cool! :-)","type":"schedule_msg"}
		*/
		if (SepiaFW.ui.isCordova){
			var d = new Date((new Date().getTime() + action.triggerIn) + 1500);		//note: the delay is to handle the foreground activity (see below, 2nd timer)
			var nid = getAndIncreaseNotificationId();
			cordova.plugins.notification.local.schedule([{
				id: nid,
				title: SepiaFW.assistant.name + ":",
				text: action.text,
				at: (d),
				sound: "res://platform_default",
				smallIcon: "res://ic_popup_reminder",
				icon: "res://icon",
				color: "303030",
				data: {"type" : action.info, "action" : "triggered", "data" : {"message" : action.text, "eventId" : action.eventId}}
			}]);
			addProActiveNotificationId(nid);
			//prevent foreground execution
			if (!proActiveMessageTimers[action.eventId]){
				proActiveMessageTimers[action.eventId] = '';
			}else{
				clearTimeout(proActiveMessageTimers[action.eventId]);
			}
			proActiveMessageTimers[action.eventId] = setTimeout(function(){
				//remove event before it can be triggered
				if (SepiaFW.ui.isVisible()){
					cordova.plugins.notification.local.cancel([nid], function(){
						//confirm?
					});
				}
			}, action.triggerIn);
		
		}else if (SepiaFW.ui.notification){
			if (!proActiveMessageTimers[action.eventId]){
				proActiveMessageTimers[action.eventId] = '';
			}else{
				clearTimeout(proActiveMessageTimers[action.eventId]);
			}
			proActiveMessageTimers[action.eventId] = setTimeout(function(){
				if (!SepiaFW.ui.isVisible()){
					SepiaFW.ui.notification.send(action.text, SepiaFW.assistant.name, '', function(note){
						window.focus();
						note.close();
						SepiaFW.ui.updateMyView(false, true);
					});
				}
			}, action.triggerIn);
		}
		//console.log('scheduled: ' + action.eventId);		//DEBUG
	}
	//properties: scheduled once and executed locally, will not show when the app is in foreground
	Events.clearAllProActiveBackgroundNotifications = function(callbackDone){
		if (SepiaFW.ui.isCordova){
			var removeIds = getProActiveNotificationIds();
			cordova.plugins.notification.local.cancel(removeIds, function(){
				if (callbackDone) callbackDone();
			});
		}else if (SepiaFW.ui.notification){
			$.each(proActiveMessageTimers, function(key, value){
				clearTimeout(value);
			});
			if (callbackDone) callbackDone();
		}else{
			if (callbackDone) callbackDone();
		}
	}
	
	//------------- TIME EVENTS (Timer, Alarm, ...) ---------------
	
	//about timeEvents
	var Timers = {};
	var removedTimerIds = []; 		//to sync deleted timers/alarms with account
	var ActivatedTimers = {};
	var timerCurrentId = 1;
	
	//Scheduler variables
	var scheduleDelay = 5000; 		//to prevent multiple syncs in a short time-period the current sync is delayed and gets shifted with each new sync request
	var SyncSchedulers = {};
	
	//SETUP TimeEvents
	Events.setupTimeEvents = function(){
		//reset ids tracking timeEvents
		resetTimeEventNotificationIds();
		//clear all background notifications
		Events.clearAllTimeEventBackgroundNotifications(function(){
			//reload Timers
			var options = {};
				options.loadOnlyData = true;
				options.updateMyView = true; 		//update my-view afterwards
			var dataset = {};	dataset.info = "direct_cmd";
				dataset.cmd = "timer;;action=<show>;;alarm_type=<timer>;;";			//TODO: make a function for that
				dataset.newReceiver = SepiaFW.assistant.id;
			SepiaFW.client.sendCommand(dataset, options);
			var dataset2 = {};	dataset2.info = "direct_cmd";
				dataset2.cmd = "timer;;action=<show>;;alarm_type=<alarmClock>;;";	//TODO: make a function for that
				dataset2.newReceiver = SepiaFW.assistant.id;
			SepiaFW.client.sendCommand(dataset2, options);
		});
	}
	
	//add timeEvent to UI and activate it
	Events.addOrRefreshTimeEvent = function(targetTimeUnix, eventType, eventData){
		var Timer = Events.getRunningOrActivatedTimeEventById(eventData.eventId);
		var reloadBackgroundNotification = false;
		if (!Timer){
			reloadBackgroundNotification = true;
			Timer = {};
			Timer.targetTime = targetTimeUnix;
			Timer.name = "sepiaFW-timedEvent-" + timerCurrentId++; 			//not to be confused with Timer.eventData.name!
			Timer.type = eventType;
			Timer.data = eventData;
			Timers[Timer.name] = Timer;
		}
		
		//final action
		scheduleTimeAction(Timer, reloadBackgroundNotification);			//assigns: Timer.action
		
		//interval action (animations)
		addTimeEventIntervalAction(Timer)		//assigns: Timer.animation and gets all relevant DOM elements (by eventId, aka data-id)

		SepiaFW.debug.info("TimeEvent - " + Timer.name + ': ADDED or REFRESHED');		//DEBUG
		return Timer;
	}
	//get an active timeEvent by name (DOM id)
	Events.getTimeEvent = function(name){
		if(name in Timers){
			return Timers[name];
		}else{
			return "";
		}
	}
	//get next timeEvent
	Events.getNextTimeEvents = function(maxTargetTime, excludeName, includePastMs){
		if (!maxTargetTime) maxTargetTime = Number.MAX_SAFE_INTEGER;
		var nextTimers = [];
		var nearestFuture = Number.MAX_SAFE_INTEGER;
		var now = new Date().getTime();
		if (includePastMs){
			now = now - includePastMs;
		}
		$.each(Timers, function(timerName, timerObj){
			if (!excludeName || (excludeName !== timerName)){
				var isValidTime = (timerObj.targetTime < maxTargetTime) && ((timerObj.targetTime - now) > 0);
				if (isValidTime){
					nextTimers.push(timerObj);
				}
				/*
				if (isValidTime && timerObj.targetTime < nearestFuture){
					nearestFuture = timerObj.targetTime;
					nextTimers = [timerObj];
				}else if (isValidTime && timerObj.targetTime == nearestFuture){
					nextTimers.push(timerObj);
				}
				*/
			}
		});
		return nextTimers;
	}
	//get an timeEvent that has been executed already
	Events.getActivatedTimeEvent = function(name){
		if(name in ActivatedTimers){
			return ActivatedTimers[name];
		}else{
			return "";
		}
	}
	//get an active timeEvent by eventId (given by server)
	Events.getRunningOrActivatedTimeEventById = function(eventId){
		var timerWithId = '';
		$.each(Timers, function(timerName, timerObj){
			if (timerObj.data && timerObj.data.eventId){
				if (timerObj.data.eventId === eventId){
					timerWithId = timerObj;
				}
			}
		});
		if (!timerWithId){
			$.each(ActivatedTimers, function(timerName, timerObj){
				if (timerObj.data && timerObj.data.eventId){
					if (timerObj.data.eventId === eventId){
						timerWithId = timerObj;
					}
				}
			});
		}
		return timerWithId;
	}
	//deactivate timeEvent - optionally resync server list afterwards
	Events.removeTimeEvent = function(name, resyncList, callbackRemovedBackgroundActivity){
		var Timer = Events.getTimeEvent(name);
		if (Timer){
			//Remove background notification
			Events.removeTimeEventBackgroundNotification(Timer, callbackRemovedBackgroundActivity);
			//clean up
			if (Timer.action) clearTimeout(Timer.action);
			//if (Timer.animation) clearInterval(Timer.animation); 	//<- animation keeps running until dom element is deleted
			delete Timers[name];
			//this might be set if a timeEvent is removed by a "UI-only-action" (e.g. remove button) and the server needs to get the info as well
			if (resyncList){
				//store eventId of deleted timer for resync
				removedTimerIds.push(Timer.data.eventId);
				scheduleTimeEventsSync(Timer.type);
			}
			SepiaFW.debug.info("TimeEvent - " + name + ': REMOVED');		//DEBUG
		
		}else if (resyncList){
			var activatedTimer = Events.getActivatedTimeEvent(name);
			if (activatedTimer){
				//store eventId of deleted timer for resync
				removedTimerIds.push(activatedTimer.data.eventId);
				scheduleTimeEventsSync(activatedTimer.type);
			}
		}
	}
	//synchronize timeEvents with server - since creating an event should be done via server request we assume that only silently removed or UI-unknown events need sync.
	Events.syncTimeEvents = function(type){
		var title = "";
		if (type === Events.TIMER){
			title = "timer";
		}else if (type === Events.ALARM || type === "alarmClock"){
			title = "alarmClock";
		}else{
			SepiaFW.debug.log('UI.Actions timeEvent: Can\'t synchronize type "' + Timer.type + '" yet!');
			return;
		}
		var listToLoad = {};
			listToLoad.section = "timeEvents";
			listToLoad.indexType = "alarms";
			if (title) listToLoad.title = title;
		SepiaFW.account.loadList(listToLoad, function(data){
			//got list(s)
			var lists = data.lists;
			var syncList = {};
			if (lists && lists.length > 0){
				//get first list - should be only one specific here!
				syncList = lists[0];
				if (!syncList.data) syncList.data = [];
				//iterate account events
				var i=0;
				var newListData = [];
				while (i < syncList.data.length){
					//is not on list of silently removed timeEvents?
					if ($.inArray(syncList.data[i].eventId, removedTimerIds) === -1){
						//TODO: use ActivatedTimers ???
						//check if timer exists and has newer lastChange date (e.g. because the name was changed in UI)
						var Timer = SepiaFW.events.getRunningOrActivatedTimeEventById(syncList.data[i].eventId);
						if (Timer && Timer.data.lastChange > syncList.data[i].lastChange){
							//console.log('updated');
							newListData.push(Timer.data);
						}else{
							//console.log('refreshed');
							newListData.push(syncList.data[i]);
						}
					}
					i++;
				}
				var removedItems = (syncList.data.length - newListData.length);
				SepiaFW.debug.info("TimeEvent - " + removedItems + " removed during synchronization");
				syncList.data = newListData;
				//save changes
				SepiaFW.account.saveList(syncList, function(data){
					//clean remove queue
					removedTimerIds = [];
					//TODO: clean up ActivatedTimers ???
					//hide all save buttons
					var cardsBodyClass = '';
					if (type === Events.TIMER){
						cardsBodyClass = ".sepiaFW-cards-list-timers";
					}else if (type === Events.ALARM){
						cardsBodyClass = ".sepiaFW-cards-list-alarms";
					}
					if (cardsBodyClass){
						$('#sepiaFW-chat-output').find(cardsBodyClass).each(function(){
							var saveBtn = $(this).parent().find('.sepiaFW-cards-list-saveBtn');
							saveBtn.removeClass('active');
						});
					}
					
				},function(msg){
					//error
					SepiaFW.ui.showPopup(msg);
				});
			
			}else{
				//TODO: in this case we need to create an alarm first
			}
		}, function(msg){
			//error
			SepiaFW.ui.showPopup(msg);
		});
	}
	
	//Schedulers and animations:
	
	//TimeEvent activation action scheduler
	function scheduleTimeAction(Timer, reloadBackgroundNotification){
		var timeoutLimit = 2000000000; 	//2147483648;
		var timeDiff = Timer.targetTime - (new Date().getTime());
		//stretch timeout
		if (timeDiff >= timeoutLimit){
			clearTimeout(Timer.action);
			Timer.action = setTimeout(function(){
				scheduleTimeAction(Timer);
			}, Math.floor(timeoutLimit/2.0));
			
		//in the past?
		}else if (timeDiff < 0){
			//do nothing for now
			return;
		
		//wait for event
		}else{
			clearTimeout(Timer.action);
			Timer.action = setTimeout(function(){
				SepiaFW.debug.info("TimeEvent - " + Timer.name + ': ACTIVATED');		//DEBUG
				//remove
				Events.removeTimeEvent(Timer.name, "", function(){
					//remove success - to prevent conflict between notification and trigger
					Events.triggerAlarm(Timer, '', '', ''); 	//start, end, error
				});
				ActivatedTimers[Timer.name] = Timer;
				
				//graphics
				var domEles = $(SepiaFW.ui.JQ_RES_VIEW_IDS).find('[data-id="' + Timer.data.eventId + '"]').find(".timeEventCenter");
				if (domEles.length > 0){
					domEles.addClass("inThePast");
					var scrollCard = $(domEles[0]).closest('.timeEvent');
					var scrollBody = scrollCard.closest(SepiaFW.ui.JQ_RES_VIEW_IDS);
					SepiaFW.ui.scrollToElement(scrollCard[0], scrollBody[0]);
				}
			}, timeDiff);
		}
		
		//prepare notification - notifications run in the background (parallel to the javascript alarm-triggers) and thus need to be managed extra :-(
		if (reloadBackgroundNotification){
			Events.setTimeEventBackgroundNotification(Timer);
		}
	}
	//TimeEvent interval action (e.g. animations)
	function addTimeEventIntervalAction(Timer){
		//TIMER
		if (Timer && Timer.type === Events.TIMER){
			//get all relevant domElements - note: this might come to early here as the elements are not yet added to the DOM :-(
			var domEles = $(SepiaFW.ui.JQ_RES_VIEW_IDS).find('[data-id="' + Timer.data.eventId + '"]').find(".sepiaFW-timer-indicator");
			//start animation
			clearInterval(Timer.animation);
			var elementsRetrivalRetry = 0;
			Timer.animation = setInterval((function(){
				if (elementsRetrivalRetry < 3){
					//workaround to give elements time to appear in DOM
					domEles = $(SepiaFW.ui.JQ_RES_VIEW_IDS).find('[data-id="' + Timer.data.eventId + '"]').find(".sepiaFW-timer-indicator");
					elementsRetrivalRetry++;
				}
				//refresh domEles by visibility check
				if (domEles.length > 0){
					domEles = domEles.filter(function(index){
						var cardBody = domEles[index].parentNode.parentNode;
						return (cardBody && cardBody.parentNode && cardBody.parentNode.parentNode);
					});
				}
				if (domEles.length < 1){
					if (elementsRetrivalRetry >= 3){
						clearInterval(this.animation);
					}
				}else{
					//still at least one visible
					var prefix = "";
					var left_ms = (Timer.targetTime - (new Date().getTime()));
					if (left_ms <= 0){
						prefix = SepiaFW.local.g('expired') + ": ";
						left_ms = left_ms * -1.0;
					}
					var dd = Math.floor(left_ms/DAY_MS);		left_ms = left_ms - (dd * DAY_MS);
					var hh = Math.floor(left_ms/HOUR_MS);		left_ms = left_ms - (hh * HOUR_MS);
					var mm = Math.floor(left_ms/MIN_MS);		left_ms = left_ms - (mm * MIN_MS);
					var ss = Math.floor(left_ms/SEC_MS);
					var newTime = (prefix + dd + "d " + hh + "h " + mm + "min " + ss + "s").trim();
					domEles.text(newTime);
					//console.log(Timer.name + ': refresh');		//DEBUG
				}
			}).bind(Timer), 1000);
		}
	}
	//TimeEvent synchronization scheduler 
	function scheduleTimeEventsSync(type){
		clearTimeout(SyncSchedulers[type]);
		SyncSchedulers[type] = setTimeout(function(){
			Events.syncTimeEvents(type);
		}, scheduleDelay);
	}
	Events.scheduleTimeEventsSync = scheduleTimeEventsSync;
	
	//EVENTS:
	
	//Background notification 
	Events.setTimeEventBackgroundNotification = function(Timer){
		//console.log('setTimeEventBackgroundNotification'); 		//DEBUG
		if (!Timer || (Timer.targetTime - new Date().getTime())<0){
			//timers of the past are rejected
			return;
		}
		if (SepiaFW.ui.isCordova){
			var d = new Date(Timer.targetTime + 500);
			var nid = getAndIncreaseNotificationId();
			cordova.plugins.notification.local.schedule([{
				id: nid,
				title: (SepiaFW.local.g(Timer.type) + ": " + d.toLocaleString()),
				text: Timer.data.name,
				at: (d),
				sound: "file://sounds/alarm.mp3",
				color: "303030",
				data: {"type" : Timer.type, "action" : "triggered", "data" : Timer.data}
			}]);
			//console.log('addTimeEventNotificationId: ' + nid); 		//DEBUG
			addTimeEventNotificationId(nid);
		}
	}
	Events.clearAllTimeEventBackgroundNotifications = function(callbackDone){
		//console.log('clearAllTimeEventBackgroundNotifications'); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			var removeIds = getTimeEventNotificationIds();
			//console.log('clear: ' + removeIds); 					//DEBUG
			cordova.plugins.notification.local.cancel(removeIds, function(){
				//console.log('done-clearAllTimeEventBackgroundNotifications'); 		//DEBUG
				//resetTimeEventNotificationIds();		//clearing that here seems to be not reliable
				if (callbackDone) callbackDone();
			});
		}else{
			//console.log('done-clearAllTimeEventBackgroundNotifications'); 		//DEBUG
			if (callbackDone) callbackDone();
		}
	}
	Events.removeTimeEventBackgroundNotification = function(Timer, callbackDone){
		//console.log('removeTimeEventBackgroundNotification'); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			//for now we have to do it the hard way:
			//1) clear all:
			Events.clearAllTimeEventBackgroundNotifications(function(){
				//2) reload all but one:
				thisName = Timer.name;
				$.each(Timers, function(name, Timer){
					if (!Timer || name !== thisName){
						Events.setTimeEventBackgroundNotification(Timer);
					}
				});
				callbackDone();
			});
		}else{
			if (callbackDone) callbackDone();
		}
	}
	//note: not used at the moment
	Events.refreshTimeEventBackgroundNotification = function(Timer){
		//console.log('refreshTimeEventBackgroundNotification'); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			//for now we have to do it the hard way:
			//1) clear all:
			Events.clearAllTimeEventBackgroundNotifications(function(){
				//2) reload all:
				Events.reloadAllTimeEventBackgroundNotifications();
			});
		}
	}
	//note: not used at the moment (except ... look one line up ^^)
	Events.reloadAllTimeEventBackgroundNotifications = function(){
		//console.log('reloadAllTimeEventBackgroundNotifications'); 		//DEBUG
		if (SepiaFW.ui.isCordova){
			var now = new Date().getTime();
			$.each(Timers, function(name, Timer){
				if ((Timer.targetTime - now) > 0){
					Events.setTimeEventBackgroundNotification(Timer);
				}
			});
		}
	}
	
	//Alarm clock
	Events.triggerAlarm = function(Timer, startCallback, endCallback, errorCallback){
		//console.log('triggerAlarm'); 			//DEBUG
		//in case the app was in background while the timer expired we block certain actions
		if ((new Date().getTime() - Timer.targetTime) > 5000){
			//block all if not triggered within 5s (optical feedback is triggered by interval action)
			//TODO: show some message? Check once for animation!
			return;
		}
		//if the app is open we trigger a simple notification just to give some visual feedback when the app is in background - it is delayed 
		setTimeout(function(){
			var titleS = SepiaFW.local.g(Timer.type); //+ ": " + (new Date().toLocaleString());
			var textS = SepiaFW.local.g('expired') + ": " + Timer.data.name;
			Events.showSimpleSilentNotification(titleS, textS);
		}, 50);
		//play sound
		if (SepiaFW.audio){
			SepiaFW.audio.playAlarmSound(startCallback, endCallback, errorCallback);
		}else{
			SepiaFW.debug.err("Alarm: Audio CANNOT be played, SepiaFW.audio is missing!");
		}
	}
	
	//------------- other notifications --------------
	
	var browserNotificationTimers = {};
	Events.cancelSimpleNotification = function(nid){
		if (SepiaFW.ui.isCordova){
			cordova.plugins.notification.local.cancel([nid]);
			
		}else if (SepiaFW.ui.notification){
			if (nid in browserNotificationTimers){
				clearTimeout(browserNotificationTimers[nid]);
				delete browserNotificationTimers[nid];
			}
		}
	}
	
	//Simple direct notifications
	Events.showSimpleSilentNotification = function(titleS, textS, data){
		//console.log('showSimpleSilentNotification'); 		//DEBUG
		Events.showSimpleNotification(titleS, textS, 'null', data);
	}
	Events.showSimpleNotification = function(titleS, textS, soundFile, data){
		//console.log("actions: " + JSON.stringify(data)); 		//DEBUG
		Events.scheduleSimpleNotification(titleS, textS, soundFile, data);
	}
	Events.scheduleSimpleNotification = function(titleS, textS, soundFile, data, date, msgId){
		var nid = -1;
		if (date && (date.getTime() - new Date().getTime())<0){
			//timers of the past are rejected
			return nid;
		}
		nid = msgId || getAndIncreaseNotificationId();
		if (SepiaFW.ui.isCordova){
			var options = {
				id: nid,
				title: titleS,
				text: textS,
				color: "303030",
				data: (data? data : {})
			}
			//sound
			if (soundFile && soundFile == 'null'){
				options.sound = null;
			}else{
				options.sound = (soundFile? soundFile : "res://platform_default");
			}
			//schedule
			if (date){
				options.at = date;
			}
			cordova.plugins.notification.local.schedule([options]);
			
		}else if (SepiaFW.ui.notification){
			//schedule
			var delay = 50;
			if (date){
				//TODO: convert delay
				//delay = ???
			}
			var options = {
				data: (data? data : {})
			}
			browserNotificationTimers[nid] = setTimeout(function(){
				SepiaFW.ui.notification.send(textS, titleS, options, function(note){
					window.focus();
					note.close();
					Events.handleLocalNotificationClick(data);
				});
				//sound
				if (soundFile && soundFile != 'null'){
					//TODO: add sound
				}
			}, delay);
		}
		return nid;
	}
	
	//handle click events on simple notifications
	Events.handleLocalNotificationClick = function(data){
		//reply sender
		if (data && data.onClickType && data.onClickType == "replySender" && data.sender){
			var chatInput = document.getElementById("sepiaFW-chat-input");
			if (chatInput){
				setTimeout(function(){
					chatInput.focus();
					chatInput.value = '@' + data.sender + " ";
				}, 300);
			}
		}
	}
	
	return Events;
}

//------------------------------------------------------------------------------------

//-----------------ACTIONS---------------------

function sepiaFW_build_ui_actions(){
	var Actions = {};
	
	//note: 'action' is 'actionInfo[i]'
	
	//BUTTON Help
	Actions.addButtonHelp = function(action, parentBlock){
		var urlBtn = document.createElement('BUTTON');
		urlBtn.className = 'chat-button-help';
		SepiaFW.ui.onclick(urlBtn, function(){
		//urlBtn.addEventListener("click", function(){ 
			var newAction = {};
			newAction.info = "direct_cmd";
			newAction.cmd = "chat;;type=help;;";
			newAction.options = { skipTTS : true, skipText : true, targetView : "bigResults" };
			SepiaFW.ui.actions.openCMD(newAction);
		});
		urlBtn.innerHTML = action.title || SepiaFW.local.g('help');
		parentBlock.appendChild(urlBtn);
	}
	
	//BUTTON TeachUI
	Actions.addButtonTeachUI = function(action, parentBlock){
		if (SepiaFW.teach){
			var teachBtn = document.createElement('BUTTON');
			teachBtn.className = 'chat-button-teach';
			var info = action.info;
			SepiaFW.ui.onclick(teachBtn, function(){
				SepiaFW.ui.closeAllMenus();
				SepiaFW.teach.openUI(info);
			});
			teachBtn.innerHTML = action.title || SepiaFW.local.g('teach_ui_btn');
			parentBlock.appendChild(teachBtn);
		}
	}
	
	//BUTTON URLs
	Actions.addButtonURL = function(action, parentBlock){
		var urlBtn = document.createElement('BUTTON');
		urlBtn.className = 'chat-button-url';
		urlBtn.setAttribute("data-url", action.url);
		SepiaFW.ui.onclick(urlBtn, function(){
		//urlBtn.addEventListener("click", function(){ 
			SepiaFW.ui.actions.openURL(action);
		});
		urlBtn.innerHTML = action.title;
		parentBlock.appendChild(urlBtn);
	}
	
	//OPEN URLs
	Actions.openURL = function(action, forceExternal){
		Actions.openUrlAutoTarget(action.url, forceExternal);
	}
	var inAppBrowserOptions = 'location=yes,toolbar=yes,mediaPlaybackRequiresUserAction=yes,allowInlineMediaPlayback=yes,hardwareback=yes,disableswipenavigation=no,clearsessioncache=no,clearcache=no';
	Actions.openUrlAutoTarget = function(url, forceExternal){
		if (SepiaFW.ui.isCordova){
			if (forceExternal 
				|| url.indexOf('https://maps.') === 0 || url.indexOf('http://maps.') === 0
				|| url.indexOf('https://www.google.com/maps/') === 0 || url.indexOf('https://www.google.de/maps/') === 0
				){
				cordova.InAppBrowser.open(url, '_system');
			}else{
				cordova.InAppBrowser.open(url, '_blank', inAppBrowserOptions);
			}
		}else{
			window.open(url, '_blank');
		}
	}
	
	//BUTTON CMDs
	Actions.addButtonCMD = function(action, sender, parentBlock){
		var cmdBtn = document.createElement('BUTTON');
		cmdBtn.className = 'chat-button-cmd';
		if (sender) action.sender = sender;
		cmdBtn.setAttribute("data-sender", action.sender);
		cmdBtn.setAttribute("data-cmd", action.cmd);
		SepiaFW.ui.onclick(cmdBtn, function(){
		//cmdBtn.addEventListener("click", function(){ 
			SepiaFW.ui.actions.openCMD(action);
			SepiaFW.debug.info("Action - sending button-cmd: " + action.cmd); 
		});
		cmdBtn.innerHTML = action.title;
		parentBlock.appendChild(cmdBtn);
	}
	
	//OPEN CMDs
	Actions.openCMD = function(action){
		if (SepiaFW.client){
			if (!action.options){
				action.options = {};
			}
			if (!action.options.targetView){
				//add default view
				action.options.targetView = "chat";
			}
			SepiaFW.client.sendCommand(action);	//handles options
		}else{
			SepiaFW.debug.info("Action: button type 'openCMD' is not supported yet.");
		}
	}
	
	//QUEUE CMDs
	Actions.queueCMD = function(action){
		if (SepiaFW.client){
			SepiaFW.client.queueCommand(action);
		}else{
			SepiaFW.debug.info("Action: 'queueCMD' is not supported yet.");
		}
	}
	
	//HTML RESULT ACTION
	Actions.buildHtmlResultAction = function(action, parentBlock, handleOptions){
		if (SepiaFW.ui.cards){
			//build card from html data
			var card = SepiaFW.ui.cards.buildCustomHtmlCardFromAction(action);
			var resultView;
			
			//check options for target view
			if (handleOptions.targetView && parentBlock){
				//this has highest prio since the handler is waiting for data in parentBlock
				parentBlock.appendChild(card);
			}else if (action.options && action.options.targetView){
				//get right view
				resultView = SepiaFW.ui.getResultViewByName(action.options.targetView);
				SepiaFW.ui.addDataToResultView(resultView, card, false, true, 500);
			}else if (!parentBlock){
				//get default view
				resultView = SepiaFW.ui.getResultViewByName("chat");
				SepiaFW.ui.addDataToResultView(resultView, card, false, true, 500);
			}else{
				parentBlock.appendChild(card);
			}
		}else{
			SepiaFW.debug.info("Action: type 'show_html_result' is not supported yet.");
		}
	}
	
	//PLAY AUDIO STREAM
	Actions.playAudioURL = function(action){
		if (SepiaFW.audio){
			if (SepiaFW.speech && (SepiaFW.speech.isSpeaking() || SepiaFW.speech.isWaitingForSpeech() )){	//its starting to get messy here with all the exceptions, we need a proper event queue ...
				//do something to delay start?
			}else{
				SepiaFW.audio.fadeOutMain(true); 		//<-- to start smoothly
			}
			SepiaFW.audio.setPlayerTitle(action.audio_title, '');
			SepiaFW.audio.playURL(action.audio_url, '');//, onStartCallback, onEndCallback, onErrorCallback)
		}else{
			SepiaFW.debug.info("Action: type 'play_audio_stream' is not supported yet.");
		}
	}
	//STOP AUDIO STREAM
	Actions.stopAudio = function(action){
		if (SepiaFW.audio){
			SepiaFW.audio.stop();
		}else{
			SepiaFW.debug.info("Action: type 'stop_audio_stream' is not supported yet.");
		}
	}
	
	//SCHEDULE Messages
	Actions.scheduleMessage = function(action, parentBlock){
		//TODO: distinguish between proActive-background and other types of messages
		if (action.info && action.info === "entertainWhileIdle"){
			SepiaFW.events.setProActiveBackgroundNotification(action);
		}else{
			SepiaFW.debug.info("Action: type '" + action.type + "' with info '" + action.info + "' is not supported yet.");
		}
	}
	
	//TIMERs and ALARMs
	Actions.timerAndAlarm = function(action, parentBlock){
		//SET
		if (action.info === "set"){
			if (action.eleType === SepiaFW.events.TIMER){
				Actions.setTimer(action, parentBlock);
			}else if (action.eleType === SepiaFW.events.ALARM){
				Actions.setAlarm(action, parentBlock);
			}else{
				SepiaFW.debug.info("Action: type '" + action.type + "' with eleType '" + action.eleType + "' is not supported yet.");
			}
		//REMOVE
		}else if (action.info === "remove"){
			var Timer = SepiaFW.events.getRunningOrActivatedTimeEventById(action.eventId);
			if (Timer){
				//remove event
				SepiaFW.events.removeTimeEvent(Timer.name);
				//clear DOM?
				$(SepiaFW.ui.JQ_RES_VIEW_IDS).find('[data-id="' + Timer.data.eventId + '"]').remove();
			}
			
		}else{
			SepiaFW.debug.info("Action: type '" + action.type + "' with info '" + action.info + "' is not supported yet.");
		}
	}
	//TIMER
	Actions.setTimer = function(action, parentBlock){
		setTimeEvent(SepiaFW.events.TIMER, action, parentBlock);
	}
	//ALARM
	Actions.setAlarm = function(action, parentBlock){
		setTimeEvent(SepiaFW.events.ALARM, action, parentBlock);
	}
	//... set method
	function setTimeEvent(eventType, action, parentBlock){
		var card;
		var timeEventEle;
		if (SepiaFW.ui.cards){
			card = SepiaFW.ui.cards.buildTimeEventElementFromAction(action, eventType);
			timeEventEle = $(card).find('.timeEvent')[0];
			
			if (parentBlock){
				if (parentBlock.id == 'sepiaFW-my-view'){
					$(parentBlock).prepend(card);
				}else{
					parentBlock.appendChild(card);
				}
			}else{
				SepiaFW.ui.insertEle("sepiaFW-chat-output", card);
				SepiaFW.ui.scrollToBottom("sepiaFW-chat-output");
			}
		}
		SepiaFW.events.addOrRefreshTimeEvent(action.targetTimeUnix, eventType, action);
	}
	
	//EVENTS START
	Actions.buildMyEventsBox = function(action, parentBlock){
		//fadeout old
		var	aButtonsAreaReplaced = document.getElementById('sepiaFW-myEvents-buttons');
		if (aButtonsAreaReplaced){
			aButtonsAreaReplaced.id = 'sepiaFW-myEvents-buttons-replaced';
			var oldEventsParent = $(aButtonsAreaReplaced).closest('.chatMsg');
			oldEventsParent.fadeOut(300, function(){
				oldEventsParent.remove();
			});
		}else{
			//first events
			$('#sepiaFW-my-view-intro').remove(); 		//remove welcome message
		}
		//make new
		var	aButtonsArea = document.createElement('DIV');
		aButtonsArea.id = 'sepiaFW-myEvents-buttons';
		aButtonsArea.className = 'chat-buttons-area';
		aButtonsArea.style.display = 'none';
		//header
		var titleNote = document.createElement('P');
		titleNote.className = 'sepiaFW-myEvents-titleNote';
		titleNote.innerHTML = SepiaFW.local.g('recommendationsFor') + " " + SepiaFW.account.getUserName() + ":";
		var dateNote = document.createElement('DIV');
		dateNote.className = 'sepiaFW-myEvents-dateHeader';
		dateNote.innerHTML = (new Date().toLocaleString());
		$(aButtonsArea).prepend(dateNote);
		$(aButtonsArea).prepend(titleNote);
		
		//show again on top
		$(parentBlock).append(aButtonsArea);
		$(aButtonsArea).fadeIn(500);
		
		return aButtonsArea;
	}
	
	//-----Handler-----
	Actions.handle = function(data, parentBlock, sender, handleOptions){
		if (data.actionInfo){
			//handle options
			if (!handleOptions) handleOptions = {};
			var doButtonsOnly = handleOptions.doButtonsOnly;
			
			//buttons will be collected here:
			var aButtonsArea = document.createElement('DIV');
			aButtonsArea.className = 'chat-buttons-area';
			parentBlock.appendChild(aButtonsArea); 	//we just assume its there and place it here before any other actions
			//iterate:
			for (var i = 0; i < data.actionInfo.length; i++) {
				var type = data.actionInfo[i].type;
				//run through everything except buttons (that does the UI build method)
				if (type){
					if (doButtonsOnly){
						if (!type.indexOf('button_') === 0){
							continue;
						}
					}
					//Events - if there are events this will be triggered first
					if (type === 'events_start'){
						//... check info?
						parentBlock.removeChild(aButtonsArea); 	//we will create a new one
						aButtonsArea = Actions.buildMyEventsBox(data.actionInfo[i], parentBlock);
					
					//HTML result
					}else if (type === 'show_html_result'){
						Actions.buildHtmlResultAction(data.actionInfo[i], parentBlock, handleOptions);
					
					//BUTTON - help
					}else if (type === 'button_help'){
						Actions.addButtonHelp(data.actionInfo[i], aButtonsArea);
						
					//BUTTON - teach UI
					}else if (type === 'button_teach_ui'){
						Actions.addButtonTeachUI(data.actionInfo[i], aButtonsArea);
					
					//BUTTON - url
					}else if (type === 'button_url' || type === 'button_in_app_browser'){
						Actions.addButtonURL(data.actionInfo[i], aButtonsArea);
						
					//BUTTON - cmd
					}else if (type === 'button_cmd'){
						Actions.addButtonCMD(data.actionInfo[i], sender, aButtonsArea);
						
					//Open URL
					}else if (type === 'open_in_app_browser'){
						Actions.openURL(data.actionInfo[i]);
					}else if (type === 'open_url'){
						Actions.openURL(data.actionInfo[i], true);
						
					//Queue CMD
					}else if (type === 'queue_cmd'){
						Actions.queueCMD(data.actionInfo[i]);
					
					//Audio stream
					}else if (type === 'play_audio_stream'){
						Actions.playAudioURL(data.actionInfo[i]);
					}else if (type === 'stop_audio_stream'){
						Actions.stopAudio(data.actionInfo[i]);
						
					//Schedule messages
					}else if (type === 'schedule_msg'){
						Actions.scheduleMessage(data.actionInfo[i], parentBlock);
					
					//Time events - TODO: type should be more general like "timeEvent"
					}else if (type === 'timer' || type === 'alarm' || type === 'timeEvent'){
						if (data.actionInfo[i].eleType === SepiaFW.events.TIMER){
							Actions.timerAndAlarm(data.actionInfo[i], parentBlock);
						}else if (data.actionInfo[i].eleType === SepiaFW.events.ALARM){
							Actions.timerAndAlarm(data.actionInfo[i], parentBlock);
						}else{
							SepiaFW.debug.info('UNSUPPORTED ACTION (timeEvent): ' + JSON.stringify(data.actionInfo[i]));
						}
					
					}else{
						SepiaFW.debug.info('UNSUPPORTED ACTION: ' + JSON.stringify(data.actionInfo[i]));
					}
				}
			}
			if (!aButtonsArea.innerHTML) parentBlock.removeChild(aButtonsArea);
		}
	}
	
	return Actions;
}