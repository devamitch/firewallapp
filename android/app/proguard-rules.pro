# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# llama.rn (on-device LLM)
-keep class com.rnllama.** { *; }

# MMKV storage
-keep class com.tencent.mmkv.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# React Native Worklets
-keep class com.swmansion.worklets.** { *; }
