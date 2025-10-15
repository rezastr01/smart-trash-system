// تنظیمات Thingspeak
const THINGSPEAK_API_KEY = 'FOB57VQ57OC6VAP8';
const THINGSPEAK_CHANNEL_ID = '3116788'; // باید از Thingspeak بگیریش
const UPDATE_INTERVAL = 5000; // 5 ثانیه

// موقعیت سطل
const trashLocation = {
    lat: 46.268571,
    lng: 38.043959,
    name: 'دانشگاه مهارت ملی'
};

let map;
let marker;

function initMap() {
    // ایجاد نقشه
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15,
        center: trashLocation,
        mapTypeControl: false,
        streetViewControl: false
    });

    // ایجاد مارکر
    marker = new google.maps.Marker({
        position: trashLocation,
        map: map,
        title: trashLocation.name,
        icon: {
            url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1IDI4LjVMMTUgMjguNUMyMy4wMDg1IDI4LjUgMjkuNSAyMi4wMDg1IDI5LjUgMTQuNUMyOS41IDcuMDA4NSAyMy4wMDg1IDAuNSAxNSAwLjVDNy4wMDg1IDAuNSAwLjUgNy4wMDg1IDAuNSAxNC41QzAuNSAyMi4wMDg1IDcuMDA4NSAyOC41IDE1IDI4LjVaIiBmaWxsPSIjMjc4RUM2Ii8+CjxwYXRoIGQ9Ik0xNSAyN0MxNSAyNyAyMi41IDE4LjUgMjIuNSAxMi41QzIyLjUgOC4wMDAwMSAxOSA0LjUgMTUgNC41QzExIDQuNSA3LjUgOC4wMDAwMSA3LjUgMTIuNUM3LjUgMTguNSAxNSAyNyAxNSAyN1oiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
            scaledSize: new google.maps.Size(30, 30)
        }
    });

    // اینفوویندو
    const infowindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50;">🚮 سطل زباله هوشمند</h3>
                <p style="margin: 0; color: #7f8c8d;">${trashLocation.name}</p>
            </div>
        `
    });

    marker.addListener('click', () => {
        infowindow.open(map, marker);
    });
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        const response = await fetch(`https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_API_KEY}`);
        const data = await response.json();
        
        if (data && data.field1) {
            updateDashboard(data);
        } else {
            throw new Error('داده‌ای دریافت نشد');
        }
    } catch (error) {
        console.error('خطا در دریافت داده:', error);
        document.getElementById('connectionStatus').textContent = '🔴 قطع';
        document.getElementById('connectionStatus').style.color = '#e74c3c';
    }
}

// آپدیت دشبورد
function updateDashboard(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    const isFull = parseInt(data.field5) === 1;
    
    // آپدیت نوار پیشرفت
    document.getElementById('progressFill').style.width = `${fillPercentage}%`;
    document.getElementById('fillPercentage').textContent = `${fillPercentage}%`;
    
    // آپدیت وضعیت
    const statusCard = document.getElementById('statusCard');
    const statusText = document.getElementById('statusText');
    const percentageText = document.getElementById('percentageText');
    
    percentageText.textContent = `${fillPercentage}%`;
    
    if (fillPercentage >= 80 || isFull) {
        statusText.textContent = 'پر 🚨';
        statusText.className = 'status status-full';
        statusCard.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
        statusCard.style.color = 'white';
    } else if (fillPercentage >= 50) {
        statusText.textContent = 'نیمه پر ⚠️';
        statusText.className = 'status status-half';
        statusCard.style.background = 'linear-gradient(135deg, #feca57, #ff9ff3)';
    } else {
        statusText.textContent = 'خالی ✅';
        statusText.className = 'status status-empty';
        statusCard.style.background = 'linear-gradient(135deg, #48dbfb, #0abde3)';
        statusCard.style.color = 'white';
    }
    
    // آپدیت اطلاعات لحظه‌ای
    document.getElementById('distanceText').textContent = `${distance} سانتی‌متر`;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('fa-IR');
    document.getElementById('connectionStatus').textContent = '🟢 متصل';
    document.getElementById('connectionStatus').style.color = '#27ae60';
    
    // اضافه کردن به تاریخچه
    addToHistory(fillPercentage, distance);
}

// اضافه کردن به تاریخچه
function addToHistory(percentage, distance) {
    const historyList = document.getElementById('historyList');
    const now = new Date();
    const timeString = now.toLocaleTimeString('fa-IR');
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span>${timeString}</span>
        <span>${percentage}% پر (${distance}cm)</span>
    `;
    
    historyList.insertBefore(historyItem, historyList.firstChild);
    
    // محدود کردن تعداد آیتم‌های تاریخچه
    if (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// شبیه‌سازی داده برای تست (اگر Thingspeak وصل نشد)
function simulateData() {
    const simulatedData = {
        field1: Math.floor(Math.random() * 100),
        field2: (5 + Math.random() * 20).toFixed(1),
        field5: Math.random() > 0.7 ? 1 : 0
    };
    
    updateDashboard(simulatedData);
    document.getElementById('connectionStatus').textContent = '🟡 حالت آزمایشی';
    document.getElementById('connectionStatus').style.color = '#f39c12';
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', function() {
    // تنظیم موقعیت
    document.getElementById('locationText').textContent = trashLocation.name;
    document.getElementById('coordinatesText').textContent = 
        `مختصات: ${trashLocation.lat.toFixed(6)}, ${trashLocation.lng.toFixed(6)}`;
    
    // شروع دریافت داده
    fetchData();
    setInterval(fetchData, UPDATE_INTERVAL);
    
    // فال‌بک برای حالت آزمایشی
    setTimeout(() => {
        if (document.getElementById('connectionStatus').textContent === '🔴 قطع') {
            simulateData();
        }
    }, 3000);
});