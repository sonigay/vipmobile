package com.vipplus.manager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "VipManager"
    }
    
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "부팅 완료 - 서비스 시작")
            
            // 서버 URL이 설정되어 있는지 확인
            val prefs = context.getSharedPreferences("VIP_MANAGER", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("SERVER_URL", "") ?: ""
            
            if (serverUrl.isNotEmpty()) {
                // 서비스 시작
                val serviceIntent = Intent(context, ManagerService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                
                Log.d(TAG, "서비스 자동 시작됨")
            } else {
                Log.w(TAG, "서버 URL이 설정되지 않아 서비스를 시작하지 않음")
            }
        }
    }
}


