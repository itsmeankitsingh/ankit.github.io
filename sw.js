const CACHE_NAME = 'bloodbank-connect-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/blood_bank_connect_page.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://images.unsplash.com/photo-1588615419957-5c0b1b3236c3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80'
];

// Install event - cache static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Opened static cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Static resources cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests with network-first strategy
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static resources with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(request)
          .then(response => {
            // Don't cache failed responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache successful responses
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
            
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/blood_bank_connect_page.html');
            }
            
            return new Response('Network error occurred', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for emergency requests
self.addEventListener('sync', event => {
  if (event.tag === 'emergency-request') {
    event.waitUntil(
      handleEmergencyRequest()
    );
  }
});

// Handle emergency requests in background
async function handleEmergencyRequest() {
  try {
    // Simulate background processing
    console.log('Processing emergency request in background');
    
    // Show notification to user
    await self.registration.showNotification('BloodBank Connect', {
      body: 'Your emergency request is being processed in the background',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'emergency-request'
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Push notifications for emergency alerts
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Emergency blood request in your area',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'accept',
        title: 'Accept',
        icon: '/icons/accept-96x96.png'
      },
      {
        action: 'decline',
        title: 'Decline',
        icon: '/icons/decline-96x96.png'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification('BloodBank Connect', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'accept') {
    // Handle accept action
    event.waitUntil(
      clients.openWindow('/#emergency-request')
    );
  } else if (event.action === 'decline') {
    // Handle decline action
    console.log('User declined the request');
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification.tag);
});

// Message handling for communication with main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
}); 