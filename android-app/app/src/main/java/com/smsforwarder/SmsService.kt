package com.smsforwarder

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

class SmsService : Service() {
    
    companion object {
        private const val TAG = "SmsService"
        private const val CHANNEL_ID = "SMS_FORWARDER_CHANNEL"
        private const val NOTIFICATION_ID = 1
        
        var isServiceRunning = false
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "서비스 생성됨")
        isServiceRunning = true
        
        // 포그라운드 서비스로 실행
        startForeground(NOTIFICATION_ID, createNotification())
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
                "SMS Forwarder 서비스",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "SMS를 서버로 전송하는 백그라운드 서비스"
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMS Forwarder 실행 중")
            .setContentText("SMS를 자동으로 서버에 전송하고 있습니다")
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}

