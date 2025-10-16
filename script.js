// تنظیمات Thingspeak
const THINGSPEAK_CHANNEL_ID = '3116788';
const THINGSPEAK_API_KEY = 'FOB57VQ57OC6VAP8';
const UPDATE_INTERVAL = 10000; // 10 ثانیه

// اطلاعات سطل‌ها
const trashCans = [
    {
        id: 1,
        name: 'سطل اصلی دانشگاه',
        location: { lat: 46.268571, lng: 38.043959 },
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null
    },
    {
        id: 2,
        name: 'سطل محوطه مرکزی',
        location: { lat: 46.269000, lng: 38.044500 },
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null
    },
    {
        id: 3,
        name: 'سطل ورودی شرقی',
        location: { lat: 46.267800, lng: 38.042800 },
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null
    }
];

let map;
let markers = [];
let isOnline = false;

// ایجاد نقشه
function initMap() {
    // ایجاد نقشه با OpenStreetMap
    map = L.map('map').setView([46.268571, 38.043959], 16);
    
    // اضافه کردن لایه نقشه
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    // ایجاد مارکر برای سطل‌ها
    createTrashMarkers();
    console.log('🗺️ نقشه با موفقیت ایجاد شد');
}

// ایجاد مارکرهای سطل‌ها
function createTrashMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: getTrashIcon(trash.status)
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        // اضافه کردن پاپ‌آپ
        updateMarkerPopup(marker, trash);
    });
}

// آیکون سطل بر اساس وضعیت
function getTrashIcon(status) {
    let color;
    
    switch(status) {
        case 'empty': color = '#27ae60'; break;
        case 'half': color = '#f39c12'; break;
        case 'full': color = '#e74c3c'; break;
        case 'offline': color = '#95a5a6'; break;
        default: color = '#3498db';
    }
    
    return L.divIcon({
        className: 'custom-trash-icon',
        html: `
            <div style="
                background: ${color};
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
            ">🗑️</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// آپدیت پاپ‌آپ مارکر
function updateMarkerPopup(marker, trash) {
    const statusText = getStatusText(trash.status);
    const timeText = trash.lastUpdate ? 
        trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
    
    marker.bindPopup(`
        <div style="padding: 12px; min-width: 220px; font-family: Vazir, sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 1px solid #ecf0f1; padding-bottom: 8px;">
                🗑️ ${trash.name}
            </h4>
            <div style="display: grid; gap: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت:</span>
                    <strong style="color: ${getStatusColor(trash.status)}">${statusText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">میزان پر:</span>
                    <strong>${trash.fillPercentage}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">فاصله:</span>
                    <strong>${trash.distance}cm</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">موقعیت:</span>
                    <strong>${trash.location.lat.toFixed(4)}, ${trash.location.lng.toFixed(4)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">بروزرسانی:</span>
                    <strong>${timeText}</strong>
                </div>
            </div>
        </div>
    `);
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        const response = await fetch(`https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 داده دریافتی:', data);
        
        if (data && data.field1) {
            isOnline = true;
            processThingSpeakData(data);
        } else {
            throw new Error('داده معتبر دریافت نشد');
        }
        
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error);
        isOnline = false;
        updateOfflineStatus();
    }
}

// پردازش داده Thingspeak
function processThingSpeakData(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    const latitude = parseFloat(data.field3);
    const longitude = parseFloat(data.field4);
    const isFull = parseInt(data.field5) === 1;
    const trashId = parseInt(data.field6) || 1;
    
    // تشخیص وضعیت
    let status;
    if (fillPercentage >= 80 || isFull) {
        status = 'full';
    } else if (fillPercentage >= 50) {
        status = 'half';
    } else {
        status = 'empty';
    }
    
    // آپدیت سطل مربوطه
    updateTrashCan(trashId, status, fillPercentage, distance, latitude, longitude);
    
    // آپدیت نمایش‌ها
    updateAllDisplays(trashId);
}

// آپدیت اطلاعات سطل
function updateTrashCan(id, status, fillPercentage, distance, lat, lng) {
    const trashIndex = trashCans.findIndex(trash => trash.id === id);
    if (trashIndex !== -1) {
        trashCans[trashIndex].status = status;
        trashCans[trashIndex].fillPercentage = fillPercentage;
        trashCans[trashIndex].distance = distance;
        trashCans[trashIndex].lastUpdate = new Date();
        
        // اگر مختصات جدید ارسال شده
        if (lat && lng) {
            trashCans[trashIndex].location.lat = lat;
            trashCans[trashIndex].location.lng = lng;
        }
    }
}

// آپدیت وضعیت آفلاین
function updateOfflineStatus() {
    trashCans.forEach(trash => {
        trash.status = 'offline';
    });
    updateAllDisplays(1);
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId) {
    updateMarkers();
    updateTrashList();
    updateOverviewCards();
    updateCurrentTrash(activeTrashId);
    updateTechnicalInfo();
}

// آپدیت مارکرها
function updateMarkers() {
    markers.forEach(markerData => {
        const trash = markerData.trash;
        const newIcon = getTrashIcon(trash.status);
        markerData.marker.setIcon(newIcon);
        
        // آپدیت موقعیت اگر تغییر کرده
        markerData.marker.setLatLng(trash.location);
        
        // آپدیت پاپ‌آپ
        updateMarkerPopup(markerData.marker, trash);
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList() {
    const trashList = document.getElementById('trashList');
    trashList.innerHTML = '';
    
    trashCans.forEach(trash => {
        const statusText = getStatusText(trash.status);
        const statusClass = getStatusClass(trash.status);
        const timeText = trash.lastUpdate ? 
            trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-name">${trash.name}</div>
                <div class="trash-status ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="detail-item">
                    <span class="detail-label">میزان پر:</span>
                    <span class="detail-value">${trash.fillPercentage}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">فاصله:</span>
                    <span class="detail-value">${trash.distance}cm</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">موقعیت:</span>
                    <span class="detail-value">${trash.location.lat.toFixed(4)}, ${trash.location.lng.toFixed(4)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">وضعیت:</span>
                    <span class="detail-value">${isOnline ? '🟢 آنلاین' : '🔴 آفلاین'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">آخرین بروزرسانی:</span>
                    <span class="detail-value">${timeText}</span>
                </div>
            </div>
        `;
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت سطل فعلی
function updateCurrentTrash(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0];
    
    document.getElementById('trashName').textContent = trash.name;
    document.getElementById('fillPercentage').textContent = `${trash.fillPercentage}%`;
    document.getElementById('fillLevel').style.width = `${trash.fillPercentage}%`;
    document.getElementById('fillLevel').style.backgroundColor = getStatusColor(trash.status);
    document.getElementById('distanceValue').textContent = `${trash.distance} cm`;
    document.getElementById('coordinatesValue').textContent = 
        `${trash.location.lat.toFixed(6)}, ${trash.location.lng.toFixed(6)}`;
    document.getElementById('lastUpdateValue').textContent = 
        trash.lastUpdate ? trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
    
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = getStatusText(trash.status);
    statusBadge.style.backgroundColor = getStatusColor(trash.status);
}

// آپدیت کارت‌های overview
function updateOverviewCards() {
    document.getElementById('onlineStatus').textContent = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
    document.getElementById('onlineStatus').style.color = isOnline ? '#27ae60' : '#e74c3c';
    
    const emptyCount = trashCans.filter(trash => trash.status === 'empty').length;
    const fullCount = trashCans.filter(trash => trash.status === 'full').length;
    
    document.getElementById('emptyTrashCans').textContent = emptyCount;
    document.getElementById('fullTrashCans').textContent = fullCount;
}

// آپدیت اطلاعات فنی
function updateTechnicalInfo() {
    document.getElementById('dataUsage').textContent = isOnline ? 
        'فعال - دیتا درحال ارسال' : 'قطع ارتباط';
    
    document.getElementById('uptime').textContent = isOnline ? 
        'درحال فعالیت' : 'قطع شده';
}

// توابع کمکی
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

// شروع برنامه
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله...');
    
    initMap();
    fetchData();
    setInterval(fetchData, UPDATE_INTERVAL);
    
    console.log('✅ سیستم وب آماده به کار است');
});
