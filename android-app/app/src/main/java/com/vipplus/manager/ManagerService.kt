package com.vipplus.manager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class ManagerService : Service() {
    
    companion object {
        private const val TAG = "VipManager"
        private const val CHANNEL_ID = "VIP_MANAGER_CHANNEL"
        private const val NOTIFICATION_ID = 1
        
        var isServiceRunning = false
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "서비스 생성됨")
        isServiceRunning = true
        
        // 포그라운드 서비스로 실행
        startForeground(NOTIFICATION_ID, createNotification())
        
        // 메시지 처리 체커 시작
        MessageChecker.start(this)
        Log.d(TAG, "메시지 체커 시작됨")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "서비스 시작됨")
        
        // 재시작 시에도 계속 실행되도록
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "서비스 종료됨")
        isServiceRunning = false
    }
    
    private fun createNotification(): Notification {
        // 알림 채널 생성 (Android 8.0 이상)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "VIP 매니저 서비스",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "백그라운드에서 데이터를 처리하는 서비스"
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VIP 매니저 실행 중")
            .setContentText("백그라운드에서 자동으로 데이터를 처리하고 있습니다")
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}


