// تنظیمات سیستم
const CHANNEL_ID = '3116788'; // شناسه کانال ThingSpeak برای دریافت داده
const API_KEY = 'FOB57VQ57OC6VAP8'; // کلید API برای احراز هویت در ThingSpeak
const UPDATE_TIME = 10000; // 10 ثانیه - فاصله زمانی بروزرسانی خودکار
const OFFLINE_THRESHOLD = 30000; // 30 ثانیه - حد آفلاین شدن سیستم

// اطلاعات سطل‌های دانشگاه مهارت ملی
const trashCans = [
    {
        id: 1, // شناسه یکتا برای سطل
        name: 'سطل اصلی دانشگاه', // نام نمایشی سطل
        location: [38.043972, 46.268583], // مختصات جغرافیایی [عرض, طول]
        status: 'unknown', // وضعیت اولیه: ناشناخته
        fill: 0, // درصد پر بودن اولیه
        distance: 0, // فاصله اندازه‌گیری شده اولیه
        lastUpdate: null, // زمان آخرین بروزرسانی (ابتدایی null)
        isReal: true // نشان می‌دهد این سطل واقعی است (داده از سنسور می‌گیرد)
    },
    {
        id: 2, // شناسه یکتا برای سطل
        name: 'سطل محوطه مرکزی', // نام نمایشی سطل
        location: [38.044300, 46.268900], // مختصات جغرافیایی [عرض, طول]
        status: 'empty', // وضعیت ثابت: خالی
        fill: 0, // درصد پر بودن اولیه
        distance: 12, // فاصله ثابت برای نمایش دمو
        lastUpdate: null, // زمان آخرین بروزرسانی
        isReal: false // سطل دمو - داده واقعی دریافت نمی‌کند
    },
    {
        id: 3, // شناسه یکتا برای سطل
        name: 'سطل ورودی شرقی', // نام نمایشی سطل
        location: [38.043600, 46.268200], // مختصات جغرافیایی [عرض, طول]
        status: 'empty', // وضعیت ثابت: خالی
        fill: 0, // درصد پر بودن اولیه
        distance: 10, // فاصله ثابت برای نمایش دمو
        lastUpdate: null, // زمان آخرین بروزرسانی
        isReal: false // سطل دمو - داده واقعی دریافت نمی‌کند
    }
];

let map; // متغیر برای ذخیره شیء نقشه Leaflet
let markers = []; // آرایه‌ای برای ذخیره مارکرهای روی نقشه
let isOnline = false; // وضعیت آنلاین/آفلاین سیستم
let lastSuccessfulUpdate = null; // زمان آخرین دریافت موفق داده از سرور
let autoRefreshInterval = null; // شناسه interval برای بروزرسانی خودکار

// سیستم آمار و مانیتورینگ
let systemStats = {
    totalFetchAttempts: 0, // تعداد کل تلاش‌های دریافت داده
    successfulFetches: 0, // تعداد دریافت‌های موفق
    failedFetches: 0, // تعداد دریافت‌های ناموفق
    lastError: null, // آخرین خطای رخ داده
    startupTime: new Date() // زمان راه‌اندازی سیستم
};

// ایجاد نقشه
function initMap() {
    // ایجاد نقشه Leaflet در المان با id="map" و تنظیم مرکز و سطح زوم
    map = L.map('map').setView([38.043972, 46.268583], 16);
    
    // افزودن لایه نقشه از OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18 // حداکثر سطح زوم مجاز
    }).addTo(map);
    
    createMarkers(); // ایجاد مارکرهای سطل‌ها روی نقشه
}

// ایجاد مارکرهای سطل‌ها
function createMarkers() {
    // حلقه روی تمام سطل‌های تعریف شده
    trashCans.forEach(trash => {
        // ایجاد مارکر در موقعیت سطل با آیکون سفارشی
        const marker = L.marker(trash.location, {
            icon: getTrashIcon(trash.status, trash.isReal)
        }).addTo(map);
        
        // ذخیره اطلاعات مارکر در آرایه
        markers.push({
            id: trash.id, // شناسه سطل
            marker: marker, // شیء مارکر Leaflet
            trash: trash // اطلاعات سطل
        });
        
        // بروزرسانی پاپ‌آپ اطلاعات مارکر
        updateMarkerPopup(marker, trash);
        
        // افزودن رویداد کلیک فقط برای سطل‌های واقعی
        if (trash.isReal) {
            marker.on('click', function() {
                updateCurrentTrashDisplay(trash.id); // نمایش اطلاعات سطل در پنل اصلی
            });
        }
    });
}

// ایجاد آیکون سفارشی برای سطل‌ها
function getTrashIcon(status, isReal) {
    let color; // متغیر برای رنگ آیکون
    // تعیین رنگ بر اساس وضعیت سطل
    switch(status) {
        case 'empty': color = '#27ae60'; break; // سبز برای خالی
        case 'half': color = '#f39c12'; break; // نارنجی برای نیمه پر
        case 'full': color = '#e74c3c'; break; // قرمز برای پر
        default: color = '#95a5a6'; // خاکستری برای وضعیت نامشخص
    }
    
    // تعیین کلاس CSS بر اساس واقعی یا دمو بودن
    const className = isReal ? 'custom-trash-icon' : 'custom-trash-icon demo';
    
    // ایجاد آیکون سفارشی با HTML
    return L.divIcon({
        className: className, // کلاس CSS
        html: `
            <div style="
                background: ${color}; // رنگ پس‌زمینه بر اساس وضعیت
                width: 40px; // عرض دایره
                height: 40px; // ارتفاع دایره
                border-radius: 50%; // تبدیل به دایره
                border: 3px solid white; // حاشیه سفید
                box-shadow: 0 2px 8px rgba(0,0,0,0.3); // سایه برای عمق
                display: flex;
                align-items: center;
                justify-content: center;
                color: white; // رنگ ایموجی
                font-size: 18px; // سایز ایموجی
                cursor: pointer; // نشانگر دست برای قابلیت کلیک
            ">🗑️</div> // ایموجی سطل زباله
        `,
        iconSize: [40, 40], // اندازه آیکون
        iconAnchor: [20, 20] // نقطه انکر (وسط آیکون)
    });
}

// آپدیت پاپ‌آپ مارکر
function updateMarkerPopup(marker, trash) {
    let statusText, timeText, systemStatus;
    
    // تنظیم اطلاعات برای سطل‌های واقعی
    if (trash.isReal) {
        statusText = getStatusText(trash.status); // متن وضعیت
        timeText = trash.lastUpdate ? 
            trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین'; // زمان به فارسی
        systemStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین'; // وضعیت سیستم
    } else {
        // اطلاعات برای سطل‌های دمو
        statusText = getStatusText(trash.status);
        timeText = 'دمو';
        systemStatus = '⚪ دمو';
    }
    
    // ایجاد محتوای پاپ‌آپ با HTML
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
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت سیستم:</span>
                    <strong>${systemStatus}</strong>
                </div>
            </div>
        </div>
    `;
    
    // اتصال پاپ‌آپ به مارکر
    marker.bindPopup(popupContent);
}

// دریافت داده از Thingspeak
async function fetchData() {
    systemStats.totalFetchAttempts++; // افزایش شمارنده تلاش‌ها
    
    try {
        console.log('🔄 دریافت داده از ThingSpeak...');
        
        const timestamp = new Date().getTime(); // زمان فعلی برای جلوگیری از کش
        const controller = new AbortController(); // کنترلر برای لغو درخواست
        const timeoutId = setTimeout(() => controller.abort(), 8000); // تایم‌اوت 8 ثانیه
        
        // ارسال درخواست به API ThingSpeak
        const response = await fetch(
            `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${API_KEY}&round=2&_=${timestamp}`,
            { signal: controller.signal } // قابلیت لغو درخواست
        );
        
        clearTimeout(timeoutId); // پاک کردن تایم‌اوت
        
        // بررسی موفقیت‌آمیز بودن پاسخ
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json(); // تبدیل پاسخ به JSON
        console.log('📊 داده دریافتی:', data);
        
        // بررسی کامل داده دریافتی
        if (data && data.created_at && data.field1 !== null && data.field2 !== null) {
            const dataTime = new Date(data.created_at).getTime(); // زمان ایجاد داده
            const currentTime = new Date().getTime(); // زمان فعلی
            const timeDiff = currentTime - dataTime; // اختلاف زمان
            
            console.log(`⏰ اختلاف زمان با سرور: ${Math.round(timeDiff/1000)} ثانیه`);
            
            // فقط اگر داده جدیدتر از 25 ثانیه باشد، پردازش کن
            if (timeDiff < 25000) {
                lastSuccessfulUpdate = Date.now(); // ذخیره زمان بروزرسانی موفق
                systemStats.successfulFetches++; // افزایش شمارنده موفق‌ها
                systemStats.lastError = null; // پاک کردن آخرین خطا
                
                processThingSpeakData(data); // پردازش داده دریافتی
                
                // فقط اگر آنلاین نیستیم، وضعیت را تغییر دهیم
                if (!isOnline) {
                    setSystemOnline();
                }
                console.log('✅ داده جدید پردازش شد');
            } else {
                console.log('❌ داده بسیار قدیمی - نادیده گرفته شد');
                systemStats.failedFetches++; // افزایش شمارنده ناموفق‌ها
                systemStats.lastError = 'داده قدیمی';
                // وضعیت آنلاین را تغییر نده
            }
        } else {
            throw new Error('داده ناقص یا نامعتبر دریافت شد');
        }
        
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error.message);
        systemStats.failedFetches++; // افزایش شمارنده ناموفق‌ها
        systemStats.lastError = error.message; // ذخیره آخرین خطا
        // در صورت خطا، وضعیت آنلاین را مستقیماً تغییر نده
    }
}

// پردازش داده Thingspeak
function processThingSpeakData(data) {
    const fillPercentage = Math.round(parseFloat(data.field1)); // درصد پر بودن
    const distance = parseFloat(data.field2); // فاصله اندازه‌گیری شده
    
    console.log(`📊 پردازش داده: ${fillPercentage}% | فاصله: ${distance}cm`);
    
    let status;
    // تعیین وضعیت بر اساس درصد پر بودن
    if (fillPercentage >= 80) {
        status = 'full'; // پر
    } else if (fillPercentage >= 50) {
        status = 'half'; // نیمه پر
    } else {
        status = 'empty'; // خالی
    }
    
    updateRealTrashCan(status, fillPercentage, distance); // بروزرسانی سطل واقعی
    updateAllDisplays(1); // بروزرسانی تمام نمایش‌ها
}

// آپدیت فقط سطل واقعی
function updateRealTrashCan(status, fillPercentage, distance) {
    const realTrash = trashCans.find(trash => trash.isReal); // پیدا کردن سطل واقعی
    if (realTrash) {
        realTrash.status = status; // بروزرسانی وضعیت
        realTrash.fill = fillPercentage; // بروزرسانی درصد پر بودن
        realTrash.distance = distance; // بروزرسانی فاصله
        realTrash.lastUpdate = new Date(); // ثبت زمان بروزرسانی
    }
}

// بررسی وضعیت آنلاین
function checkSystemOnline() {
    const now = Date.now(); // زمان فعلی
    
    // اگر هیچ بروزرسانی موفقی وجود ندارد
    if (!lastSuccessfulUpdate) {
        console.log('🔴 هیچ داده موفقی دریافت نشده - آفلاین');
        setSystemOffline();
        return;
    }
    
    const timeSinceLastUpdate = now - lastSuccessfulUpdate; // زمان از آخرین بروزرسانی
    console.log(`⏰ ${Math.round(timeSinceLastUpdate/1000)} ثانیه از آخرین بروزرسانی موفق`);
    
    // اگر بیش از 30 ثانیه از آخرین بروزرسانی گذشته باشد، آفلاین شود
    if (timeSinceLastUpdate > OFFLINE_THRESHOLD) {
        console.log('🔴 سیستم آفلاین - داده قدیمی');
        setSystemOffline();
    }
    // اگر کمتر از 25 ثانیه گذشته باشد و آنلاین نیست، آنلاین شود
    else if (timeSinceLastUpdate < 25000) {
        if (!isOnline) {
            console.log('✅ سیستم آنلاین شد');
            setSystemOnline();
        }
    }
    // بین 25 تا 30 ثانیه - وضعیت را تغییر نده
    else {
        console.log('⚠️ وضعیت نامشخص - حفظ وضعیت فعلی');
    }
}

// تنظیم وضعیت آنلاین سیستم
function setSystemOnline() {
    if (!isOnline) {
        isOnline = true; // تغییر وضعیت به آنلاین
        console.log('🎉 سیستم آنلاین شد');
        
        const realTrash = trashCans.find(trash => trash.isReal);
        if (realTrash && realTrash.status === 'unknown') {
            // اگر وضعیت ناشناخته بود، به خالی تغییر بده
            realTrash.status = 'empty';
            realTrash.fill = 0;
        }
        
        updateAllDisplays(1); // بروزرسانی نمایش‌ها
    }
}

// تنظیم وضعیت آفلاین سیستم
function setSystemOffline() {
    if (isOnline) {
        isOnline = false; // تغییر وضعیت به آفلاین
        console.log('🔴 سیستم آفلاین شد');
        
        const realTrash = trashCans.find(trash => trash.isReal);
        if (realTrash) {
            realTrash.status = 'unknown'; // تغییر وضعیت به ناشناخته
            realTrash.fill = 0; // ریست درصد پر بودن
            realTrash.distance = 0; // ریست فاصله
            realTrash.lastUpdate = new Date(); // زمان آفلاین شدن را ثبت کن
        }
        
        updateAllDisplays(1); // بروزرسانی نمایش‌ها
    }
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId = 1) {
    updateMarkers(); // بروزرسانی مارکرهای نقشه
    updateTrashList(); // بروزرسانی لیست سطل‌ها
    updateOverviewCards(); // بروزرسانی کارت‌های آمار
    updateCurrentTrashDisplay(activeTrashId); // بروزرسانی نمایش سطل فعال
    updateConnectionStatus(); // بروزرسانی وضعیت ارتباط
}

// آپدیت مارکرها روی نقشه
function updateMarkers() {
    markers.forEach(markerData => {
        const trash = markerData.trash;
        
        // فقط سطل‌های واقعی را بروزرسانی کن
        if (trash.isReal) {
            const newIcon = getTrashIcon(trash.status, trash.isReal); // آیکون جدید
            markerData.marker.setIcon(newIcon); // تنظیم آیکون جدید
            updateMarkerPopup(markerData.marker, trash); // بروزرسانی پاپ‌آپ
        }
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList() {
    const trashList = document.getElementById('trashList');
    if (!trashList) return; // اگر المان وجود ندارد، برگرد
    
    trashList.innerHTML = ''; // پاک کردن محتوای قبلی
    
    // ایجاد المان برای هر سطل
    trashCans.forEach(trash => {
        let statusText, timeText, displayFill, displayDistance, onlineStatus;
        
        if (trash.isReal) {
            statusText = getStatusText(trash.status);
            timeText = trash.lastUpdate ? 
                trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
        } else {
            statusText = getStatusText(trash.status);
            timeText = 'دمو';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = '⚪ دمو';
        }
        
        const statusClass = `state-${trash.status}`; // کلاس وضعیت برای استایل
        const demoClass = trash.isReal ? '' : 'demo'; // کلاس دمو
        
        // ایجاد المان سطل
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status} ${demoClass}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-title">${trash.name}</div>
                <div class="trash-state ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="trash-detail">
                    <span>میزان پر:</span>
                    <span>${displayFill}%</span>
                </div>
                <div class="trash-detail">
                    <span>فاصله:</span>
                    <span>${displayDistance}cm</span>
                </div>
                <div class="trash-detail">
                    <span>کد سطل:</span>
                    <span>${trash.id}</span>
                </div>
                <div class="trash-detail">
                    <span>وضعیت:</span>
                    <span>${onlineStatus}</span>
                </div>
                <div class="trash-detail">
                    <span>آخرین بروزرسانی:</span>
                    <span>${timeText}</span>
                </div>
            </div>
        `;
        
        // افزودن رویداد کلیک فقط برای سطل‌های واقعی
        if (trash.isReal) {
            trashItem.addEventListener('click', () => {
                updateCurrentTrashDisplay(trash.id);
            });
        } else {
            trashItem.style.cursor = 'not-allowed'; // غیرفعال کردن کلیک برای دمو
        }
        
        trashList.appendChild(trashItem); // افزودن به لیست
    });
}

// آپدیت کارت‌های آمار کلی
function updateOverviewCards() {
    const realTrash = trashCans.find(trash => trash.isReal); // پیدا کردن سطل واقعی
    let emptyCount = 0; // شمارنده سطل‌های خالی
    let fullCount = 0; // شمارنده سطل‌های پر

    if (realTrash) {
        if (realTrash.status === 'empty') emptyCount = 1; // اگر خالی است
        if (realTrash.status === 'full') fullCount = 1; // اگر پر است
    }
    
    const emptyCansElement = document.getElementById('emptyCans'); // المان سطل‌های خالی
    const fullCansElement = document.getElementById('fullCans'); // المان سطل‌های پر
    const totalCansElement = document.getElementById('totalCans'); // المان کل سطل‌ها
    
    if (emptyCansElement) emptyCansElement.textContent = emptyCount; // بروزرسانی تعداد خالی
    if (fullCansElement) fullCansElement.textContent = fullCount; // بروزرسانی تعداد پر
    if (totalCansElement) totalCansElement.textContent = trashCans.length; // بروزرسانی تعداد کل
}

// آپدیت نمایش سطل فعلی
function updateCurrentTrashDisplay(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0]; // پیدا کردن سطل یا استفاده از پیش‌فرض
    
    if (!trash.isReal) return; // فقط سطل‌های واقعی قابل نمایش هستند
    
    const trashNameElement = document.getElementById('trashName'); // المان نام سطل
    const gaugeTextElement = document.getElementById('gaugeText'); // المان متن گیج
    const gaugeFillElement = document.getElementById('gaugeFill'); // المان پر شدن گیج
    const trashDistanceElement = document.getElementById('trashDistance'); // المان فاصله
    const trashStatusElement = document.getElementById('trashStatus'); // المان وضعیت
    const lastUpdateElement = document.getElementById('lastUpdate'); // المان آخرین بروزرسانی
    
    if (trashNameElement) trashNameElement.textContent = trash.name; // بروزرسانی نام
    if (gaugeTextElement) gaugeTextElement.textContent = trash.fill + '%'; // بروزرسانی درصد
    
    if (gaugeFillElement) {
        gaugeFillElement.style.height = trash.fill + '%'; // تنظیم ارتفاع گیج
        gaugeFillElement.style.backgroundColor = getStatusColor(trash.status); // تنظیم رنگ گیج
    }
    
    if (trashDistanceElement) trashDistanceElement.textContent = trash.distance + ' cm'; // بروزرسانی فاصله
    if (trashStatusElement) trashStatusElement.textContent = getStatusText(trash.status); // بروزرسانی وضعیت
    if (lastUpdateElement) {
        lastUpdateElement.textContent = 
            trash.lastUpdate ? trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین'; // بروزرسانی زمان
    }
    
    if (map) {
        map.setView(trash.location, 16); // مرکز کردن نقشه روی سطل انتخاب شده
    }
}

// آپدیت وضعیت ارتباط
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus'); // المان وضعیت ارتباط
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.textContent = 'آنلاین'; // متن آنلاین
        statusElement.style.color = '#27ae60'; // رنگ سبز
    } else {
        statusElement.textContent = 'آفلاین'; // متن آفلاین
        statusElement.style.color = '#e74c3c'; // رنگ قرمز
    }
}

// گزارش وضعیت سیستم
function logSystemStatus() {
    const now = new Date(); // زمان فعلی
    const uptime = Math.round((now - systemStats.startupTime) / 1000); // محاسبه مدت فعالیت
    
    console.log('=== 📊 گزارش وضعیت سیستم ===');
    console.log('⏰ زمان راه‌اندازی:', systemStats.startupTime.toLocaleTimeString('fa-IR'));
    console.log('🕒 مدت فعالیت:', uptime, 'ثانیه');
    console.log('📡 وضعیت آنلاین:', isOnline ? '🟢 آنلاین' : '🔴 آفلاین');
    console.log('🔄 آخرین بروزرسانی موفق:', 
        lastSuccessfulUpdate ? new Date(lastSuccessfulUpdate).toLocaleTimeString('fa-IR') : '❌ ندارد');
    console.log('📈 تلاش‌های دریافت:', systemStats.totalFetchAttempts);
    console.log('✅ دریافت‌های موفق:', systemStats.successfulFetches);
    console.log('❌ دریافت‌های ناموفق:', systemStats.failedFetches);
    
    if (lastSuccessfulUpdate) {
        const diff = now.getTime() - lastSuccessfulUpdate;
        console.log(`⏱️ زمان از آخرین بروزرسانی: ${Math.round(diff/1000)} ثانیه`);
    }
    
    if (systemStats.lastError) {
        console.log('🚨 آخرین خطا:', systemStats.lastError);
    }
    
    const realTrash = trashCans.find(trash => trash.isReal);
    if (realTrash) {
        console.log('🗑️ وضعیت سطل واقعی:', realTrash.status, `(${realTrash.fill}%)`);
    }
    
    console.log('========================');
}

// توابع کمکی
function getStatusText(status) {
    switch(status) {
        case 'empty': return 'خالی'; // متن فارسی برای خالی
        case 'half': return 'نیمه پر'; // متن فارسی برای نیمه پر
        case 'full': return 'پر'; // متن فارسی برای پر
        case 'unknown': return 'آفلاین'; // متن فارسی برای آفلاین
        default: return 'نامشخص'; // متن پیش‌فرض
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'empty': return '#27ae60'; // رنگ سبز برای خالی
        case 'half': return '#f39c12'; // رنگ نارنجی برای نیمه پر
        case 'full': return '#e74c3c'; // رنگ قرمز برای پر
        case 'unknown': return '#95a5a6'; // رنگ خاکستری برای آفلاین
        default: return '#3498db'; // رنگ آبی برای پیش‌فرض
    }
}

// تابع بروزرسانی دستی
function refreshData() {
    console.log('🔄 بروزرسانی دستی...');
    fetchData(); // فراخوانی تابع دریافت داده
}

// تابع بروزرسانی خودکار
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn'); // پیدا کردن دکمه
    if (!btn) return;
    
    if (autoRefreshInterval) {
        // غیرفعال کردن
        clearInterval(autoRefreshInterval); // پاک کردن interval
        autoRefreshInterval = null; // ریست کردن متغیر
        btn.textContent = '⏰ بروزرسانی خودکار: غیرفعال'; // تغییر متن دکمه
        btn.style.background = '#e74c3c'; // تغییر رنگ به قرمز
        console.log('⏸️ بروزرسانی خودکار غیرفعال شد');
    } else {
        // فعال کردن
        autoRefreshInterval = setInterval(fetchData, UPDATE_TIME); // ایجاد interval جدید
        btn.textContent = '⏰ بروزرسانی خودکار: فعال'; // تغییر متن دکمه
        btn.style.background = '#27ae60'; // تغییر رنگ به سبز
        console.log('▶️ بروزرسانی خودکار فعال شد');
    }
}

function startAutoRefresh() {
    // توقف interval قبلی
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // شروع interval جدید
    autoRefreshInterval = setInterval(fetchData, UPDATE_TIME);
}

// راه‌اندازی مجدد سیستم
function restartSystem() {
    console.log('🔄 راه‌اندازی مجدد سیستم...');
    
    // توقف تمام intervalها
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // ریست متغیرها
    isOnline = false;
    lastSuccessfulUpdate = null;
    
    // ریست آمار
    systemStats = {
        totalFetchAttempts: 0,
        successfulFetches: 0,
        failedFetches: 0,
        lastError: null,
        startupTime: new Date()
    };
    
    // راه‌اندازی مجدد
    startAutoRefresh();
    
    console.log('✅ سیستم راه‌اندازی مجدد شد');
}

// راه‌اندازی سیستم
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله هوشمند...');
    
    // مقداردهی اولیه
    initMap(); // راه‌اندازی نقشه
    updateAllDisplays(); // بروزرسانی اولیه نمایش‌ها
    
    // شروع بروزرسانی خودکار
    startAutoRefresh();
    
    // شروع چک کردن وضعیت آنلاین هر 5 ثانیه
    setInterval(checkSystemOnline, 5000);
    
    // مانیتورینگ سیستم هر 10 ثانیه
    setInterval(logSystemStatus, 10000);
    
    // اولین دریافت داده با تاخیر 2 ثانیه
    setTimeout(fetchData, 2000);
    
    console.log('✅ سیستم وب آماده به کار است');
});

// مدیریت رویدادهای صفحه
window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval); // پاک کردن interval هنگام بستن صفحه
    }
});

// توابع عمومی برای دسترسی از کنسول
window.systemControls = {
    refreshData: fetchData, // تابع بروزرسانی دستی
    restartSystem: restartSystem, // تابع راه‌اندازی مجدد
    getStatus: logSystemStatus, // تابع دریافت وضعیت
    checkOnline: checkSystemOnline, // تابع بررسی آنلاین
    getStats: () => systemStats // تابع دریافت آمار
};
