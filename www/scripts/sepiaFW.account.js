//ACCOUNT - Login, logout, login-popup etc. ...	
function sepiaFW_build_account(){
	var Account = {};
	
	var userId = "";
	var userToken = "";
	var userName = "Boss";
	var language = SepiaFW.config.appLanguage;
	
	var pwdIsToken = false;
	
	//---- Account settings mapping (to simplify access) ----//
	Account.USER_NAME = "uname";
	Account.NICK_NAME = "nick";
	Account.FIRST_NAME = "first";
	Account.LAST_NAME = "last";
	
	Account.INFOS = "infos";
	Account.LANGUAGE_PREF = "lang_code";
	
	Account.LISTS = "lists";
	Account.ADDRESSES = "addresses";
	Account.ADDRESS_TAG_HOME = "user_home";
	Account.ADDRESS_TAG_WORK = "user_work";
	Account.CONTACTS = "contacts";
	
	//---- broadcasting ----
	
	function broadcastLoginSuccess(){
	}
	function broadcastLoginFail(){
	}
	
	function broadcastLogoutTry(){
		//close all menues
		SepiaFW.ui.closeAllMenus();
		
		//reset background events
		SepiaFW.debug.log("Logout: Removing all background events.");
		if (SepiaFW.events){
			SepiaFW.events.resetAllBackgroundEvents(function(state){
				Account.finishedLogoutActionSection('Background-events', state);
			});
		}else{
			Account.finishedLogoutActionSection('Background-events', true);
		}
		
		//clear all view histories
		SepiaFW.debug.log("Logout: Clearing all views.");
		SepiaFW.ui.clearAllOutputViews();
		
		//delete all other data we can find
		SepiaFW.debug.log("Logout: Deleting all cached app data.");
		if (SepiaFW.ui.isCordova && window.CacheClear){
			if (window.localStorage){
				var backupHost = window.localStorage.getItem('sepiaFW-host');
				window.localStorage.clear();
				if (backupHost){
					window.localStorage.setItem("sepiaFW-host", backupHost);
				}
			}
			window.CacheClear(function(status) {
				//Success
				SepiaFW.debug.log("Logout: App cache and local storage cleared.");
				Account.finishedLogoutActionSection('App-data', true);
			},function(status) {
				//Error
				SepiaFW.debug.err("Logout: Local storage cleared but error in app cache plugin!");
				Account.finishedLogoutActionSection('App-data', false);
			});
		}else if (window.localStorage){
			var backupHost = window.localStorage.getItem('sepiaFW-host');
			window.localStorage.clear();
			if (backupHost){
				window.localStorage.setItem("sepiaFW-host", backupHost);
			}
			Account.finishedLogoutActionSection('App-data', true);
		}else{
			Account.finishedLogoutActionSection('App-data', true);
		}
		
		//close websocket connection
		/*
		if (SepiaFW.webSocket && SepiaFW.webSocket.client){
			SepiaFW.webSocket.client.closeConnection();
		}
		*/
	}
	function broadcastLogoutSuccess(){
		if (SepiaFW.webSocket) SepiaFW.webSocket.client.closeConnection();
	}
	function broadcastLogoutFail(){
		if (SepiaFW.webSocket) SepiaFW.webSocket.client.closeConnection();
	}
	
	//----------------------
	
	//get user id
	Account.getUserId = function(){
		return userId;
	}
	//get user name
	Account.getUserName = function(){
		return userName;
	}
	//get key
	Account.getKey = function(){
		return (userId + ";" + userToken);
	}
	//get token
	Account.getToken = function(){
		return userToken;
	}
	//get language
	Account.getLanguage = function(){
		return language;
	}
	
	//load data from account
	//TODO: test and errorCallback
	Account.loadAccountData = function(fieldArray, successCallback, errorCallback){
		getAccountData("", fieldArray, function(data){
			SepiaFW.debug.log('Account - successfully loaded account data.');
			if (successCallback){
				if (data.get_result){
					successCallback(data.get_result);
				}else{
					if (errorCallback) errorCallback("Unexpected error in Account.loadAccountData.");
				}
			}
		}, function(msg){
			SepiaFW.ui.showPopup(msg);
			//errorCallback
		});
	}
	//save account settings value
	//TODO: add callbacks?
	Account.saveAccountData = function(dataBody){
		setAccountData("", dataBody, function(data){
			SepiaFW.debug.log('Account - successfully stored account data.');
		}, function(msg){
			SepiaFW.ui.showPopup(msg);
		});
	}
	//delete data from account
	//TODO: test and errorCallback
	Account.deleteAccountData = function(fieldArray, successCallback, errorCallback){
		deleteAccountData("", fieldArray, function(data){
			SepiaFW.debug.log('Account - successfully deleted account data.');
			if (successCallback){
				if (data.delete_result){
					successCallback(data.delete_result);
				}else{
					if (errorCallback) errorCallback("Unexpected error in Account.deleteAccountData.");
				}
			}
		}, function(msg){
			SepiaFW.ui.showPopup(msg);
			//errorCallback
		});
	}
	
	//load address from account
	Account.loadAddressByTag = function(tag, successCallback, errorCallback){
		if (Array.isArray(tag)){
			SepiaFW.debug.log('Account.loadAddressByTag warning! Requesting via array is possible but with this method '
				+ 'you will only get back the result of the first request in the array!');
			tag = tag[0];
		}
		//TODO: change from tag to tags
		if (tag === Account.ADDRESS_TAG_HOME || tag === Account.ADDRESS_TAG_WORK){
			var dataBody = {};
			var adr = new Object();
			adr.specialTag = tag;
			dataBody[Account.ADDRESSES] = [adr];
			//load
			getUserData("", dataBody, function(data){
				SepiaFW.debug.log('Account - successfully loaded address with tag: ' + tag);
				if (successCallback){
					//we only return the result of the first request
					if (data.get_result){
						var addresses = data.get_result[Account.ADDRESSES];
						if (addresses && addresses.length > 0 && addresses[0].length > 0){
							//we only take one address (expecting one result for one tag)
							successCallback(addresses[0][0]);
						}else{
							successCallback({});
						}
					}else{
						if (errorCallback) errorCallback("Unexpected error in Account.loadAddressByTag.");
					}
				}
			}, function(msg){
				if (errorCallback) errorCallback(msg);
			});
		}else{
			SepiaFW.debug.err("Account - cannot load address with tag '" + tag + "' yet");
			if (errorCallback) errorCallback('Address tag unknown.');
		}
	}
	//save address to account
	Account.saveAddressWithTag = function(tag, street, streetNbr, city, zip, country){
		if (tag === Account.ADDRESS_TAG_HOME || tag === Account.ADDRESS_TAG_WORK){
			//build address object
			var adr = new Object();
			adr.specialTag = tag;
			adr.city = city || '';
			adr.country = country || '';
			adr.code = zip || '';
			adr.street = street || '';
			adr.s_nbr = streetNbr || '';
			adr.latitude = '';
			adr.longitude = '';
			var dataBody = {};
			dataBody[Account.ADDRESSES] = [adr];
			//store data
			setUserData("", dataBody, function(data){
				SepiaFW.debug.log('Account - successfully stored address with tag: ' + tag);
			}, function(msg){
				SepiaFW.ui.showPopup(msg);
			});
			
		}else{
			SepiaFW.debug.err("Account - cannot store address with tag '" + tag + "' yet");
		}
	}
	//delete address from account
	Account.deleteAddress = function(adrData){
		var dataBody = {};
		if (Array.isArray(adrData)){
			/*$.each(adrData, function(index, a){
				delete a....;		//<- remove stuff to save some space, it is not necessary to identify the address (everything except id and tag?)
			});*/
			dataBody[Account.ADDRESSES] = adrData;
		}else{
			//delete adrData...;		//<- remove stuff to save some space, it is not necessary to identify the address
			dataBody[Account.ADDRESSES] = [adrData];
		}
		deleteUserData("", dataBody, function(data){
			if (successCallback){ successCallback(data); }
		}, function(data){
			if (errorCallback){ errorCallback(data) }
		});
	}
	
	//save list (shopping, todo, alarms, timers, ...)
	Account.saveList = function(listData, successCallback, errorCallback){
		var dataBody = {};
		if (Array.isArray(listData)){
			dataBody[Account.LISTS] = listData;
		}else{
			dataBody[Account.LISTS] = [listData];
		}
		setUserData("", dataBody, function(data){
			if (successCallback){ successCallback(data); }
		}, function(data){
			if (errorCallback){ errorCallback(data) }
		});
	}
	//load list - actually it loads an array of lists that fit to the request 
	//(or an array of arrays if the request itself is an array)
	Account.loadList = function(listData, successCallback, errorCallback){
		var dataBody = {};
		if (Array.isArray(listData)){
			SepiaFW.debug.log('Account.loadList warning! Requesting via array is possible but with this method '
				+ 'you will only get back the result of the first request in the array!');
			dataBody[Account.LISTS] = listData;
		}else{
			dataBody[Account.LISTS] = [listData];
		}
		getUserData("", dataBody, function(data){
			if (successCallback){
				//we only return the result of the first request
				if (data.get_result){
					var lists = data.get_result[Account.LISTS];
					if (lists && lists.length > 0){
						successCallback({
							"lists" : lists[0]
						});
					}else{
						successCallback({
							"lists" : []
						});
					}
				}else{
					if (errorCallback) errorCallback("Unexpected error in Account.loadList.");
				}
			}
		}, function(data){
			if (errorCallback){ errorCallback(data) }
		});
	}
	//delete list
	Account.deleteList = function(listData, successCallback, errorCallback){
		var dataBody = {};
		if (Array.isArray(listData)){
			$.each(listData, function(index, lst){
				delete lst.data;		//<- remove data to save some space, it is not necessary to identify the list
			});
			dataBody[Account.LISTS] = listData;
		}else{
			delete listData.data;		//<- remove data to save some space, it is not necessary to identify the list
			dataBody[Account.LISTS] = [listData];
		}
		deleteUserData("", dataBody, function(data){
			if (successCallback){ successCallback(data); }
		}, function(data){
			if (errorCallback){ errorCallback(data) }
		});
	}
	
	//-------------------------------------------------
	
	//Show form inside login box and hide "wait" message
	Account.showLoginForm = function(aniTime){
		if (aniTime != undefined){
			$('#sepiaFW-login-form').fadeIn(aniTime);
			$('#sepiaFW-login-wait').hide();
		}else{
			$('#sepiaFW-login-form').fadeIn(600);
			$('#sepiaFW-login-wait').hide();
		}
	}
	
	//Setup login-box
	Account.setupLoginBox = function(){
		$('#sepiaFW-login-box').animate({
			opacity: 1.0,
		}, 500, function(){
			$(this).removeClass('sepiaFW-translucent-10');
		});
		//try restore from localStorage to avoid login popup - refresh required after e.g. 1 day = 1000*60*60*24
		var account = SepiaFW.data.get('account');
		if (account && account.userToken && account.lastRefresh && ((new Date().getTime() - account.lastRefresh) < (1000*60*60*12))){
			userId = account.userId;
			userToken = account.userToken;
			userName = account.userName;	if (userName)	SepiaFW.config.broadcastUserName(userName);
			language = account.language;	if (language)	SepiaFW.config.broadcastLanguage(language);
			SepiaFW.debug.log('Account: login restored');
			
			var lBox = document.getElementById("sepiaFW-login-box");
			if (lBox && lBox.style.display != 'none'){
				Account.toggleLoginBox();
			}
			Account.afterLogin();

		//try refresh
		}else if (account && account.userToken){
			SepiaFW.debug.log('Account: trying login auto-refresh with token');
			pwdIsToken = true;
			Account.login(account.userId, account.userToken, onLoginSuccess, onLoginError, onLoginDebug);

		}else{
		    if ("splashscreen" in navigator){
                navigator.splashscreen.hide();
            }
			Account.showLoginForm();
		}
		
		//add language selector
		var langSelBox = document.getElementById("sepiaFW-language-selector");
		if (langSelBox){
			langSelBox.appendChild(SepiaFW.ui.build.languageSelector("sepiaFW-login-language-dropdown", function(selectedLanguage){
				var url = SepiaFW.tools.setParameterInURL(window.location.href, 'lang', selectedLanguage);
				window.location.href = url;
			}));
		}
		
		//login-button
		var logSendBtn = document.getElementById("sepiaFW-login-send");
		if (logSendBtn){
			$(logSendBtn).off();
			$(logSendBtn).on("click", function () {
				sendLoginFromBox();
			});
		}
		//id placeholder
		var idInput = document.getElementById("sepiaFW-login-id");
		idInput.placeholder = SepiaFW.local.username;
		$(idInput).off();
		$(idInput).on("keypress", function (e) {
			if (e.keyCode === 13) { sendLoginFromBox(); }
		});
		//keypress on pwd
		var pwdInput = document.getElementById("sepiaFW-login-pwd");
		pwdInput.placeholder = SepiaFW.local.password;
		$(pwdInput).off();
		$(pwdInput).on("keypress", function (e) {
			if (e.keyCode === 13) { sendLoginFromBox(); }
		});
		//close-button
		var clsBtn = document.getElementById("sepiaFW-login-close");
		if (clsBtn){
			$(clsBtn).off();
			$(clsBtn).on("click", function () {
				Account.toggleLoginBox();
				Account.afterLogin();
			});
		}
	}
	function sendLoginFromBox(){
		pwdIsToken = false;
		var id = document.getElementById("sepiaFW-login-id").value;
		var pwdField = document.getElementById("sepiaFW-login-pwd");
		var pwd = pwdField.value;
		pwdField.value = '';
		if (id && pwd && (id.length > 3) && (pwd.length > 5)) {
			userId = id;
			Account.login(userId, pwd, onLoginSuccess, onLoginError, onLoginDebug);
		}else{
			onLoginError(SepiaFW.local.g('loginFailedPlain'));
		}
	}
	function onLoginSuccess(data){
		var lBox = document.getElementById("sepiaFW-login-box");
		if (lBox && lBox.style.display != 'none'){
			Account.toggleLoginBox();
		}
		
		//NOTE: we use the generalized top-level fields here that are different to the default "account" ones
		//uid, email, phone, user_roles
		//user_name
		//user_lang_code
		//user_birth
		//bot_character
		
		userToken = data.keyToken;
		userId = data.uid;
		//get call name
		if (data["user_name"]){
			var uname = data["user_name"];
			var unn = uname[Account.NICK_NAME];
			var unf = uname[Account.FIRST_NAME];
			if (unn && unn.length>1){
				userName = unn;
			}else if (unf && unf.length>1){
				userName = unf;
			}
			//SepiaFW.debug.info(unn  + ", " + unf + ", " + uname);
			//broadcast
			SepiaFW.config.broadcastUserName(userName);
		}
		//get preferred language
		if (data['user_lang_code'] && data['user_lang_code'].length > 1){
			language = data['user_lang_code'];
			SepiaFW.config.broadcastLanguage(language);
		}
		
		//store data
		var account = new Object();
		account.userId = userId;
		account.userToken = userToken;
		account.userName = userName;
		account.language = language;
		account.lastRefresh = new Date().getTime();
		SepiaFW.data.set('account', account);
		
		//what happens next? typically this is used by a client implementation to continue
		broadcastLoginSuccess();
		Account.afterLogin();
	}
	function onLoginError(errorText){
	    if ("splashscreen" in navigator){
            navigator.splashscreen.hide();
        }
		Account.showLoginForm(0);
		var lBoxError = document.getElementById("sepiaFW-login-status");
		if(lBoxError){
			lBoxError.innerHTML = errorText;
			SepiaFW.animate.flash("sepiaFW-login-status", 150);
		}else{
			SepiaFW.debug.err('Login: ' + errorText);
		}
		broadcastLoginFail();
	}
	function onLoginDebug(data){
		//SepiaFW.debug.log('Account debug: ' + JSON.stringify(data));
	}
	
	//toggle login box on off
	Account.toggleLoginBox = function(){
	    if ("splashscreen" in navigator){
            navigator.splashscreen.hide();
        }
		//reset status text
		var lBoxError = document.getElementById("sepiaFW-login-status");
		if (lBoxError){
			lBoxError.innerHTML = '';
		}
		var box = document.getElementById("sepiaFW-login-box");
		if (box && box.style.display == 'none'){
			$("#sepiaFW-main-window").addClass("sepiaFW-translucent-10");
			$(box).removeClass('sepiaFW-translucent-10').fadeIn(300, function(){
				$(box).css({'opacity':1.0}); 		//strange bug here sometimes leaves the box translucent
			});
		}else if (box){
			//box.style.display = 'none';
			$(box).stop().fadeOut(300, function(){
				$(box).removeClass('sepiaFW-translucent-10');
				$(box).css({'opacity':1.0}); 		//strange bug here sometimes leaves the box translucent
			});
			$("#sepiaFW-main-window").removeClass("sepiaFW-translucent-10");
		}
	}
	
	//Logout action e.g. for button
	Account.logoutAction = function(logoutAll){
		logoutSectionsFinished = 0;
		listenForLogoutActions = true;
		//info message
		var config = {
				buttonOneName : "Ok I will wait",
				buttonOneAction : function(){},
				buttonTwoName : "Skip (unsafe)",
				buttonTwoAction : function(){ location.reload(); },
			};
		SepiaFW.ui.showPopup('Signing out ...', config);
		
		//try logout - fails silently (low prio, good idea???)
		if (userId && userToken){
			if (logoutAll){
				Account.logoutAll((userId + ";" + userToken), onLogoutSuccess, onLogoutFail, onLogoutDebug);
			}else{
				Account.logout((userId + ";" + userToken), onLogoutSuccess, onLogoutFail, onLogoutDebug);
			}
		}else{
			Account.finishedLogoutActionSection('Server-logout', true);
		}
		//remove account data
		SepiaFW.data.del('account');
		//broadcast try and remove more data
		broadcastLogoutTry();
		
		//do other user/client actions
		Account.duringLogout();
		Account.finishedLogoutActionSection('Custom-action', true);
		
		//open box
		/*
		var lBox = document.getElementById("sepiaFW-login-box");
		if (lBox && lBox.style.display == 'none'){
			Account.toggleLoginBox();
		}
		*/
	}
	function onLogoutSuccess(data){
		SepiaFW.debug.log('Account: logout successful');
		broadcastLogoutSuccess();
		Account.finishedLogoutActionSection('Server-logout', true);
	}
	function onLogoutFail(data){
		SepiaFW.debug.err('Account: complete logout failed! But local data has been removed.');
		broadcastLogoutFail();
		Account.finishedLogoutActionSection('Server-logout', false);
	}
	function onLogoutDebug(data){
		//SepiaFW.debug.log('Account debug: ' + JSON.stringify(data));
	}
	
	//Finish logout try by letting all 'sections' report in
	var logoutSectionsToFinish = 4;		//1:Server-logout, 2:App-data, 3:Background-events, 4:Custom-action
	var logoutSectionsFinished = 0;
	var listenForLogoutActions = false;
	//TODO: add a timeout, count true/false
	Account.finishedLogoutActionSection = function(sectionName, sectionSuccess){
		if (listenForLogoutActions){
			//console.log('Section: ' + sectionName + "; success: " + sectionSuccess); 		//DEBUG
			logoutSectionsFinished++;
			if (logoutSectionsFinished >= logoutSectionsToFinish){
				listenForLogoutActions = false;
				logoutSectionsFinished = 0;
				//info message
				var config = {
						buttonOneName : "Return to sign in",
						buttonOneAction : function(){ location.reload(); }
					};
				SepiaFW.ui.showPopup('Sign-out done!', config);
				Account.afterLogout();
			}
		}
	}
	
	//---- API communication ----
	
	//LOGIN
	Account.login = function(userid, pwd, successCallback, errorCallback, debugCallback){
		SepiaFW.ui.showLoader();
		//hash password
		if (pwd && !pwdIsToken){
			//encrypt
			pwd = getSHA256(pwd);
		}
		//call authentication API for validation
		var api_url = SepiaFW.config.assistAPI + "authentication";
		var dataBody = new Object();
		dataBody.action = "validate";
		dataBody.KEY = userid + ";" + pwd;
		//dataBody.GUUID = userid;		//<-- DONT USE THAT IF ITS NOT ABSOLUTELY NECESSARY (its bad practice and a much heavier load for the server!)
		//dataBody.PWD = pwd;
		dataBody.client = SepiaFW.config.clientInfo;
		//SepiaFW.debug.info('URL: ' + api_url);
		$.ajax({
			url: api_url,
			timeout: 5000,
			type: "POST",
			data: JSON.stringify(dataBody),
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache"
			},
			success: function(data) {
				SepiaFW.ui.hideLoader();
				if (debugCallback) debugCallback(data);
				if (data && data.result){
					var status = data.result;
					if (status == "fail"){
						if (data.code && data.code == 3){
							if (errorCallback) errorCallback(SepiaFW.local.g('loginFailedServer'));
						}else{
							if (errorCallback) errorCallback(SepiaFW.local.g('loginFailedUser'));
						}
						return;
					}
					//assume success
					else{
						if(data.keyToken && (data.keyToken.length > 7)){
							//----callback----
							//console.log(JSON.stringify(data)); 		//DEBUG
							if (successCallback) successCallback(data);
						}
					}		
				}else{
					if (errorCallback) errorCallback("Login failed! Sorry, but there seems to be an unknown error :-(");
				}
			},
			error: function(data) {
				SepiaFW.ui.hideLoader();
				SepiaFW.client.checkNetwork(function(){
					if (errorCallback) errorCallback("Login failed! Sorry, but it seems the server does not answer :-(");
				}, function(){
					if (errorCallback) errorCallback("Login failed! Sorry, but it seems you are offline :-(");
				});
				if (debugCallback) debugCallback(data);
			}
		});
	}
	Account.afterLogin = function(){};
	
	//LOGOUT
	Account.logout = function(key, successCallback, errorCallback, debugCallback){
		authApiCall("logout", key, successCallback, errorCallback, debugCallback);
	}
	Account.logoutAll = function(key, successCallback, errorCallback, debugCallback){
		authApiCall("logoutAllClients", key, successCallback, errorCallback, debugCallback);
	}
	function authApiCall(action, key, successCallback, errorCallback, debugCallback){
		SepiaFW.ui.showLoader();
		var apiUrl = SepiaFW.config.assistAPI + "authentication";
		var dataBody = new Object();
		dataBody.action = action;
		dataBody.KEY = key;
		dataBody.client = SepiaFW.config.clientInfo;
		$.ajax({
			url: apiUrl,
			timeout: 5000,
			type: "POST",
			data: JSON.stringify(dataBody),
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache"
			},
			success: function(data) {
				SepiaFW.ui.hideLoader();
				if (debugCallback) debugCallback(data);
				if (data.result && data.result === "fail"){
					if (errorCallback) errorCallback('Sorry, but the log-out process failed! Please log-in again to overwrite old token.');
					return;
				}
				//--callback--
				if (successCallback) successCallback(data);
			},
			error: function(data) {
				SepiaFW.ui.hideLoader();
				SepiaFW.client.checkNetwork(function(){
					if (errorCallback) errorCallback('Sorry, but the logout process failed because the server could not be reached :-( Please wait a bit and then log-in again to overwrite old token!');
				}, function(){
					if (errorCallback) errorCallback('Sorry, but the logout process failed because it seems you are offline :-( Please wait for a connection and then simply log-in again.');
				});
				if (debugCallback) debugCallback(data);
			}
		});
	}
	
	Account.afterLogout = function(){}; 		//executed after all logout sections finished
	Account.duringLogout = function(){};		//executed before finish message, blocks sections-complete if synchronous
	
	//-------------------
	
	//GET ACCOUNT-DATA
	function getAccountData(key, fieldArray, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "account";
		var data = {
			"get" : fieldArray
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	//SET ACCOUNT-DATA
	function setAccountData(key, accountData, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "account";
		var data = {
			"set" : accountData
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	//DELETE ACCOUNT-DATA
	function deleteAccountData(key, fieldArray, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "account";
		var data = {
			"delete" : fieldArray
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	
	//GET USER-DATA
	function getUserData(key, userData, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "userdata";
		var data = {
			"get" : userData
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	//SET USER-DATA
	function setUserData(key, userData, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "userdata";
		var data = {
			"set" : userData
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	//DELETE USER-DATA
	function deleteUserData(key, userData, successCallback, errorCallback, debugCallback){
		var apiUrl = SepiaFW.config.assistAPI + "userdata";
		var data = {
			"delete" : userData
		};
		dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback);
	}
	//set, get or delete data
	function dataTransfer(apiUrl, key, data, successCallback, errorCallback, debugCallback){
		SepiaFW.ui.showLoader();
		if (key){
			data.KEY = key;
		}else if (userId && userToken){
			data.KEY = (userId + ";" + userToken);
		}else{
			if (errorCallback) errorCallback("Data transfer failed! Not authorized or missing 'KEY'");
			return;
		}
		data.client = SepiaFW.config.clientInfo;
		//SepiaFW.debug.log('URL: ' + apiUrl);
		//SepiaFW.debug.log('Body: ' + JSON.stringify(data));
		$.ajax({
			url: apiUrl,
			timeout: 15000,
			type: "POST",
			data: JSON.stringify(data),
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache"
			},
			success: function(data) {
				SepiaFW.ui.hideLoader();
				if (debugCallback) debugCallback(data);
				if (data && data.result){
					var status = data.result;
					if (status == "fail"){
						if ((data.code || data.result_code) && (data.code == 3 || data.result_code == 3)){
							if (errorCallback) errorCallback("Data transfer failed! Communication error(?) - Msg: " + data.error);
						}else{
							if (errorCallback) errorCallback("Data transfer failed! Msg: " + data.error);
						}
						return;
					}
					//assume success
					else{
						//SepiaFW.debug.log('Data result: ' + JSON.stringify(data));
						if (successCallback) successCallback(data);
					}		
				}else{
					if (errorCallback) errorCallback("Data transfer failed! Sorry, but there seems to be an unknown error :-(");
				}
			},
			error: function(data) {
				SepiaFW.ui.hideLoader();
				SepiaFW.client.checkNetwork(function(){
					if (errorCallback) errorCallback("Data transfer failed! Sorry, but it seems you are offline :-(");
				}, function(){
					if (errorCallback) errorCallback("Data transfer failed! Sorry, but it seems the network or the server do not answer :-(");
				});
				if (debugCallback) debugCallback(data);
			}
		});
	}
	
	//------------- helpers ---------------
	
	//sha256 hash + salt
	function getSHA256(data){
		return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(data + "salty1"));
	}
	
	//-------------------------------------
	
	return Account;
}