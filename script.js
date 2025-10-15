// تنظیمات Thingspeak
const THINGSPEAK_API_KEY = 'FOB57VQ57OC6VAP8';
const THINGSPEAK_CHANNEL_ID = '3116788';
const UPDATE_INTERVAL = 10000; // 10 ثانیه

// اطلاعات سطل‌ها (می‌تونی بعداً اضافه کنی)
const trashCans = [
    {
        id: 1,
        name: 'سطل دانشگاه مهارت ملی',
        location: { lat: 46.268571, lng: 38.043959 },
        type: 'main',
        lastUpdate: null,
        status: 'unknown'
    }
];

let map;
let markers = [];
let lastDataTime = null;
let isOnline = false;

// ایجاد نقشه
function initMap() {
    map = L.map('map').setView([46.268571, 38.043959], 13);
    
    // اضافه کردن لایه نقشه (رایگان - بدون API Key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // ایجاد مارکر برای سطل‌ها
    createTrashMarkers();
}

// ایجاد مارکرهای سطل‌ها
function createTrashMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: getTrashIcon('unknown')
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        // اضافه کردن پاپ‌آپ
        marker.bindPopup(`
            <div style="padding: 10px; min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🗑️ ${trash.name}</h4>
                <div style="color: #7f8c8d; font-size: 12px;">
                    <div>وضعیت: <span id="popup-status-${trash.id}">درحال بارگذاری...</span></div>
                    <div>آخرین بروزرسانی: <span id="popup-time-${trash.id}">-</span></div>
                </div>
            </div>
        `);
    });
}

// آیکون سطل بر اساس وضعیت
function getTrashIcon(status) {
    let iconColor;
    
    switch(status) {
        case 'empty':
            iconColor = 'green';
            break;
        case 'half':
            iconColor = 'orange';
            break;
        case 'full':
            iconColor = 'red';
            break;
        case 'offline':
            iconColor = 'gray';
            break;
        default:
            iconColor = 'blue';
    }
    
    return L.divIcon({
        className: `trash-marker ${status}`,
        html: `<div style="
            background-color: ${iconColor}; 
            width: 25px; 
            height: 25px; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
        ">🗑️</div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 12]
    });
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        const response = await fetch(`https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_API_KEY}&timezone=Asia/Tehran`);
        const data = await response.json();
        
        console.log('📊 داده دریافتی:', data);
        
        if (data && data.field1) {
            lastDataTime = new Date(data.created_at);
            isOnline = true;
            updateAllDisplays(data);
        } else {
            throw new Error('داده‌ای دریافت نشد');
        }
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error);
        isOnline = false;
        updateOfflineStatus();
    }
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    const latitude = parseFloat(data.field3);
    const longitude = parseFloat(data.field4);
    const isFull = parseInt(data.field5) === 1;
    
    // تشخیص وضعیت
    let status;
    if (!isOnline) {
        status = 'offline';
    } else if (fillPercentage >= 80 || isFull) {
        status = 'full';
    } else if (fillPercentage >= 50) {
        status = 'half';
    } else {
        status = 'empty';
    }
    
    // آپدیت مارکرها
    updateMarkers(status, fillPercentage, distance);
    
    // آپدیت لیست سطل‌ها
    updateTrashList(status, fillPercentage, distance);
    
    // آپدیت کارت‌های overview
    updateOverviewCards(status);
    
    // آپدیت اطلاعات فنی
    updateTechnicalInfo(data);
}

// آپدیت وضعیت آفلاین
function updateOfflineStatus() {
    updateMarkers('offline', 0, 0);
    updateTrashList('offline', 0, 0);
    updateOverviewCards('offline');
    updateTechnicalInfo(null);
}

// آپدیت مارکرها
function updateMarkers(status, percentage, distance) {
    markers.forEach(markerData => {
        const newIcon = getTrashIcon(status);
        markerData.marker.setIcon(newIcon);
        
        // آپدیت پاپ‌آپ
        const statusText = getStatusText(status);
        const timeText = isOnline ? new Date().toLocaleTimeString('fa-IR') : 'آفلاین';
        
        markerData.marker.setPopupContent(`
            <div style="padding: 10px; min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🗑️ ${markerData.trash.name}</h4>
                <div style="color: #7f8c8d; font-size: 12px;">
                    <div>وضعیت: <strong style="color: ${getStatusColor(status)}">${statusText}</strong></div>
                    <div>میزان پر: <strong>${percentage}%</strong></div>
                    <div>فاصله: <strong>${distance}cm</strong></div>
                    <div>آخرین بروزرسانی: <strong>${timeText}</strong></div>
                </div>
            </div>
        `);
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList(status, percentage, distance) {
    const trashList = document.getElementById('trashList');
    trashList.innerHTML = '';
    
    markers.forEach(markerData => {
        const statusText = getStatusText(status);
        const statusClass = getStatusClass(status);
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${status}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-name">${markerData.trash.name}</div>
                <div class="trash-status ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="detail-item">
                    <span class="detail-label">میزان پر:</span>
                    <span class="detail-value">${percentage}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">فاصله:</span>
                    <span class="detail-value">${distance}cm</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">موقعیت:</span>
                    <span class="detail-value">${markerData.trash.location.lat.toFixed(4)}, ${markerData.trash.location.lng.toFixed(4)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">وضعیت:</span>
                    <span class="detail-value">${isOnline ? '🟢 آنلاین' : '🔴 آفلاین'}</span>
                </div>
            </div>
        `;
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت کارت‌های overview
function updateOverviewCards(status) {
    document.getElementById('onlineStatus').textContent = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
    document.getElementById('onlineStatus').style.color = isOnline ? '#27ae60' : '#e74c3c';
    
    if (isOnline) {
        if (status === 'full') {
            document.getElementById('emptyTrashCans').textContent = '0';
            document.getElementById('fullTrashCans').textContent = '1';
        } else {
            document.getElementById('emptyTrashCans').textContent = '1';
            document.getElementById('fullTrashCans').textContent = '0';
        }
    } else {
        document.getElementById('emptyTrashCans').textContent = '0';
        document.getElementById('fullTrashCans').textContent = '0';
    }
}

// آپدیت اطلاعات فنی
function updateTechnicalInfo(data) {
    document.getElementById('lastUpdate').textContent = isOnline ? 
        new Date().toLocaleTimeString('fa-IR') : 'آفلاین';
    
    document.getElementById('dataUsage').textContent = isOnline ? 
        'فعال - دیتا درحال ارسال' : 'قطع ارتباط';
    
    // محاسبه مدت زمان فعالیت
    updateUptime();
}

// تابع‌های کمکی
function getStatusText(status) {
    switch(status) {
        case 'empty': return 'خالی';
        case 'half': return 'نیمه پر';
        case 'full': return 'پر';
        case 'offline': return 'آفلاین';
        default: return 'نامشخص';
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'empty': return 'status-empty';
        case 'half': return 'status-half';
        case 'full': return 'status-full';
        case 'offline': return 'status-offline';
        default: return 'status-offline';
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'empty': return '#27ae60';
        case 'half': return '#f39c12';
        case 'full': return '#e74c3c';
        case 'offline': return '#95a5a6';
        default: return '#3498db';
    }
}

function updateUptime() {
    // می‌تونی اینجا منطق پیچیده‌تری برای محاسبه آپتایم اضافه کنی
    document.getElementById('uptime').textContent = isOnline ? 'درحال فعالیت' : 'قطع شده';
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    fetchData();
    setInterval(fetchData, UPDATE_INTERVAL);
    
    // آپدیت هر 1 دقیقه برای اطلاعات فنی
    setInterval(updateUptime, 60000);
});
