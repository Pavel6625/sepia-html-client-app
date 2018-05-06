#!/bin/sh
#
APP_NAME="SepiaFW-P4"
# create project
sleep 2
echo "#Creating '$APP_NAME' ..."
cordova create $APP_NAME de.bytemind.sepia.app.web $APP_NAME
#
# copy folders
sleep 2
echo "#Transfering code ..."
cp -r www $APP_NAME
cp -r plugin_mods $APP_NAME
cp -r resources $APP_NAME
cp -r hooks $APP_NAME
cp config.xml $APP_NAME/config.xml
cd $APP_NAME
#
# add plugins
sleep 2
echo "#Adding plugins ..."
cordova plugin add cordova-plugin-device
cordova plugin add cordova-plugin-geolocation
cordova plugin add cordova-plugin-inappbrowser
cordova plugin add cordova-plugin-tts
cordova plugin add cordova-plugin-whitelist
cordova plugin add cordova-universal-links-plugin
cordova plugin add cordova-plugin-statusbar
cordova plugin add cordova-plugin-splashscreen
cordova plugin add cordova-plugin-cache-clear
cordova plugin add cordova-custom-config
cordova plugin add plugin_mods/speechrecognition/org.apache.cordova.speech.speechrecognition
#cordova plugin add de.appplant.cordova.plugin.local-notification
cordova plugin add plugin_mods/localnotifications/de.appplant.cordova.plugin.local-notification
cordova plugin add cordova-android-support-gradle-release
#
# overwrite plugin mods
sleep 2
echo "#Updating plugins ..."
cp -f "plugin_mods/inappbrowser/android/InAppBrowser.java" "plugins/cordova-plugin-inappbrowser/src/android/"
cp -r -f "plugin_mods/inappbrowser/plugin.xml" "plugins/cordova-plugin-inappbrowser/plugin.xml"
cp -r -f "plugin_mods/inappbrowser/android/res/" "plugins/cordova-plugin-inappbrowser/src/android/res/"
#cp -r -f "resources/icons/android/notifications/res/" "plugins/de.appplant.cordova.plugin.local-notification/src/android/res/"
#
# add android platform
sleep 2
echo "#Adding platform ..."
cordova platform add android@6.4.0
#
# prepare build
echo "#Preparing build ..."
cordova prepare android
# overwrite icons (this will be replaced with a proper implementation)
sleep 2
echo "#Replacing icons and theme with launch screen ..."
cp -r -f "resources/icons/android/notifications/res/" "platforms/android/res/"
cp -r "resources/themes/android/background_splash.xml" "platforms/android/res/drawable/background_splash.xml"
cp -r "resources/themes/android/launch_screen.png" "platforms/android/res/drawable/launch_screen.png"
cp -r "resources/themes/android/styles.xml" "platforms/android/res/values/styles.xml"
echo "#DONE"
