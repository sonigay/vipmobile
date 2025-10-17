package com.smsforwarder

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    
    private lateinit var serverUrlInput: EditText
    private lateinit var phoneNumberInput: EditText
    private lateinit var saveButton: Button
    private lateinit var testButton: Button
    private lateinit var statusText: TextView
    private lateinit var lastSmsText: TextView
    
    private val PERMISSION_REQUEST_CODE = 100
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // UI 초기화
        serverUrlInput = findViewById(R.id.serverUrlInput)
        phoneNumberInput = findViewById(R.id.phoneNumberInput)
        saveButton = findViewById(R.id.saveButton)
        testButton = findViewById(R.id.testButton)
        statusText = findViewById(R.id.statusText)
        lastSmsText = findViewById(R.id.lastSmsText)
        
        // 저장된 설정 불러오기
        val prefs = getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        val defaultUrl = "https://port-0-jegomap2-md0ol3n075a69e78.sel5.cloudtype.app"
        val savedUrl = prefs.getString("SERVER_URL", defaultUrl)
        val savedPhoneNumber = prefs.getString("PHONE_NUMBER", "")
        
        serverUrlInput.setText(savedUrl)
        phoneNumberInput.setText(savedPhoneNumber)
        
        // 저장 버튼
        saveButton.setOnClickListener {
            val url = serverUrlInput.text.toString().trim()
            val phoneNumber = phoneNumberInput.text.toString().trim()
            
            if (url.isEmpty()) {
                Toast.makeText(this, "서버 URL을 입력해주세요", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            if (phoneNumber.isEmpty()) {
                Toast.makeText(this, "이 폰의 전화번호를 입력해주세요", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            prefs.edit()
                .putString("SERVER_URL", url)
                .putString("PHONE_NUMBER", phoneNumber)
                .apply()
            
            Toast.makeText(this, "저장되었습니다", Toast.LENGTH_SHORT).show()
            
            // 서비스 시작
            startSmsService()
            updateStatus()
        }
        
        // 테스트 버튼
        testButton.setOnClickListener {
            testServerConnection()
        }
        
        // 권한 확인 및 요청
        checkAndRequestPermissions()
        
        // 상태 업데이트
        updateStatus()
        
        // 마지막 SMS 정보 표시
        updateLastSmsInfo()
    }
    
    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECEIVE_SMS)
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_SMS)
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.SEND_SMS)
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_PHONE_STATE)
        }
        
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
        } else {
            startSmsService()
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                Toast.makeText(this, "권한이 허용되었습니다", Toast.LENGTH_SHORT).show()
                startSmsService()
            } else {
                Toast.makeText(this, "SMS 권한이 필요합니다", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun startSmsService() {
        val serviceIntent = Intent(this, SmsService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }
    
    private fun updateStatus() {
        val prefs = getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("SERVER_URL", "미설정") ?: "미설정"
        val isRunning = SmsService.isServiceRunning
        
        val status = if (isRunning) {
            "🟢 서비스 실행 중\n서버: $serverUrl"
        } else {
            "🔴 서비스 중지됨\n서버: $serverUrl"
        }
        
        statusText.text = status
    }
    
    private fun updateLastSmsInfo() {
        val prefs = getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        val lastSms = prefs.getString("LAST_SMS", "수신된 SMS 없음") ?: "수신된 SMS 없음"
        val lastTime = prefs.getString("LAST_SMS_TIME", "") ?: ""
        
        val info = if (lastTime.isEmpty()) {
            lastSms
        } else {
            "마지막 수신: $lastTime\n$lastSms"
        }
        
        lastSmsText.text = info
    }
    
    private fun testServerConnection() {
        val prefs = getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("SERVER_URL", "") ?: ""
        
        if (serverUrl.isEmpty()) {
            Toast.makeText(this, "서버 URL을 먼저 저장해주세요", Toast.LENGTH_SHORT).show()
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val testData = mapOf(
                    "sender" to "TEST",
                    "receiver" to "TEST",
                    "message" to "연결 테스트 메시지",
                    "timestamp" to SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                        .format(Date())
                )
                
                val result = ApiClient.registerSms(serverUrl, testData)
                
                withContext(Dispatchers.Main) {
                    if (result) {
                        Toast.makeText(this@MainActivity, "✅ 서버 연결 성공!", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this@MainActivity, "❌ 서버 연결 실패", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "오류: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        updateStatus()
        updateLastSmsInfo()
    }
}

