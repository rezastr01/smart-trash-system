// تنظیمات سیستم
const CHANNEL_ID = '3116788';
const API_KEY = 'FOB57VQ57OC6VAP8';
const UPDATE_TIME = 10000; // 10 ثانیه

// اطلاعات سطل‌های دانشگاه مهارت ملی
const trashCans = [
    {
        id: 1,
        name: 'سطل اصلی دانشگاه',
        location: [38.043972, 46.268583],
        status: 'unknown',
        fill: 0,
        distance: 0,
        lastUpdate: null
    },
    {
        id: 2,
        name: 'سطل محوطه مرکزی',
        location: [38.044300, 46.268900],
        status: 'unknown',
        fill: 0,
        distance: 0,
        lastUpdate: null
    },
    {
        id: 3,
        name: 'سطل ورودی شرقی',
        location: [38.043600, 46.268200],
        status: 'unknown',
        fill: 0,
        distance: 0,
        lastUpdate: null
    }
];

let map;
let markers = [];
let isOnline = false;
let updateCount = 0;

// ایجاد نقشه
function initMap() {
    // ایجاد نقشه با مرکز دانشگاه مهارت ملی
    map = L.map('map').setView([38.043972, 46.268583], 16);
    
    // اضافه کردن لایه نقشه OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    // ایجاد مارکر برای سطل‌ها
    createMarkers();
    
    console.log('🗺️ نقشه با موفقیت ایجاد شد');
}

// ایجاد مارکرهای سطل‌ها
function createMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: getTrashIcon(trash.status)
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        // آپدیت پاپ‌آپ مارکر
        updateMarkerPopup(marker, trash);
        
        // اضافه کردن event برای کلیک روی مارکر
        marker.on('click', function() {
            updateCurrentTrashDisplay(trash.id);
        });
    });
}

// ایجاد آیکون سفارشی برای سطل‌ها
function getTrashIcon(status) {
    let color;
    switch(status) {
        case 'empty': color = '#27ae60'; break;
        case 'half': color = '#f39c12'; break;
        case 'full': color = '#e74c3c'; break;
        default: color = '#95a5a6';
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
                cursor: pointer;
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
    
    const popupContent = `
        <div style="padding: 12px; min-width: 220px; font-family: Vazir, sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🗑️ ${trash.name}</h4>
            <div style="display: grid; gap: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت:</span>
                    <strong style="color: ${getStatusColor(trash.status)}">${statusText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">میزان پر:</span>
                    <strong>${trash.fill}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">فاصله:</span>
                    <strong>${trash.distance}cm</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">موقعیت:</span>
                    <strong>${trash.location[0].toFixed(6)}, ${trash.location[1].toFixed(6)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">بروزرسانی:</span>
                    <strong>${timeText}</strong>
                </div>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        console.log('📡 درحال دریافت داده از Thingspeak...');
        
        const response = await fetch(
            `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 داده دریافتی:', data);
        
        if (data && data.field1) {
            isOnline = true;
            updateCount++;
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
    
    // تشخیص وضعیت سطل
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
    
    // آپدیت تمام نمایش‌ها
    updateAllDisplays(trashId);
}

// آپدیت اطلاعات سطل
function updateTrashCan(id, status, fillPercentage, distance, lat, lng) {
    const trashIndex = trashCans.findIndex(trash => trash.id === id);
    if (trashIndex !== -1) {
        trashCans[trashIndex].status = status;
        trashCans[trashIndex].fill = fillPercentage;
        trashCans[trashIndex].distance = distance;
        trashCans[trashIndex].lastUpdate = new Date();
        
        // اگر مختصات جدید ارسال شده
        if (lat && lng) {
            trashCans[trashIndex].location[0] = lat;
            trashCans[trashIndex].location[1] = lng;
        }
    }
}

// آپدیت وضعیت آفلاین
function updateOfflineStatus() {
    trashCans.forEach(trash => {
        trash.status = 'unknown';
    });
    updateAllDisplays(1);
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId = 1) {
    updateMarkers();
    updateTrashList();
    updateOverviewCards();
    updateCurrentTrashDisplay(activeTrashId);
    updateConnectionStatus();
}

// آپدیت مارکرها روی نقشه
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
        const statusClass = `state-${trash.status}`;
        const timeText = trash.lastUpdate ? 
            trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-title">${trash.name}</div>
                <div class="trash-state ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="trash-detail">
                    <span>میزان پر:</span>
                    <span>${trash.fill}%</span>
                </div>
                <div class="trash-detail">
                    <span>فاصله:</span>
                    <span>${trash.distance}cm</span>
                </div>
                <div class="trash-detail">
                    <span>کد سطل:</span>
                    <span>${trash.id}</span>
                </div>
                <div class="trash-detail">
                    <span>وضعیت:</span>
                    <span>${isOnline ? '🟢 آنلاین' : '🔴 آفلاین'}</span>
                </div>
                <div class="trash-detail">
                    <span>آخرین بروزرسانی:</span>
                    <span>${timeText}</span>
                </div>
            </div>
        `;
        
        // اضافه کردن event برای کلیک روی آیتم لیست
        trashItem.addEventListener('click', () => {
            updateCurrentTrashDisplay(trash.id);
        });
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت کارت‌های آمار کلی
function updateOverviewCards() {
    const emptyCount = trashCans.filter(trash => trash.status === 'empty').length;
    const fullCount = trashCans.filter(trash => trash.status === 'full').length;
    
    document.getElementById('emptyCans').textContent = emptyCount;
    document.getElementById('fullCans').textContent = fullCount;
    document.getElementById('totalCans').textContent = trashCans.length;
}

// آپدیت نمایش سطل فعلی
function updateCurrentTrashDisplay(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0];
    
    // آپدیت اطلاعات اصلی
    document.getElementById('trashName').textContent = trash.name;
    document.getElementById('gaugeText').textContent = trash.fill + '%';
    document.getElementById('gaugeFill').style.height = trash.fill + '%';
    document.getElementById('gaugeFill').style.backgroundColor = getStatusColor(trash.status);
    document.getElementById('trashDistance').textContent = trash.distance + ' cm';
    document.getElementById('trashStatus').textContent = getStatusText(trash.status);
    document.getElementById('lastUpdate').textContent = 
        trash.lastUpdate ? trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
    
    // مرکز کردن نقشه روی سطل انتخاب شده
    if (map) {
        map.setView(trash.location, 16);
    }
}

// آپدیت وضعیت ارتباط
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = isOnline ? 'آنلاین' : 'آفلاین';
    statusElement.style.color = isOnline ? '#27ae60' : '#e74c3c';
}

// توابع کمکی
function getStatusText(status) {
    switch(status) {
        case 'empty': return 'خالی';
        case 'half': return 'نیمه پر';
        case 'full': return 'پر';
        case 'unknown': return 'نامشخص';
        default: return 'نامشخص';
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'empty': return '#27ae60';
        case 'half': return '#f39c12';
        case 'full': return '#e74c3c';
        case 'unknown': return '#95a5a6';
        default: return '#3498db';
    }
}

// تابع بروزرسانی دستی
function refreshData() {
    console.log('🔄 بروزرسانی دستی داده‌ها...');
    fetchData();
}

// راه‌اندازی سیستم
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله هوشمند...');
    
    // مقداردهی اولیه
    initMap();
    updateAllDisplays();
    
    // شروع بروزرسانی خودکار
    setInterval(fetchData, UPDATE_TIME);
    
    // اولین دریافت داده
    setTimeout(fetchData, 2000);
    
    console.log('✅ سیستم وب آماده به کار است');
});
