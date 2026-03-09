import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const STORAGE_KEY = 'todo-items-v1';
const SETTINGS_KEY = 'todo-settings-v1';
const NOTIFICATION_CHANNEL_ID = 'todo-reminders';
const PENDING_SUMMARY_NOTIFICATION_KIND = 'pending-summary';
const PENDING_SUMMARY_TIMES = [
  { hour: 10, minute: 0 },
  { hour: 14, minute: 30 },
  { hour: 19, minute: 0 },
];
const MAP_LOCATION_TIMEOUT_MS = 4000;
const AMAZON_LOCATION_REGION = 'us-east-2';
const AMAZON_LOCATION_MAP_NAME = 'provider/default';
const AMAZON_LOCATION_API_KEY =
  'v1.public.eyJqdGkiOiJmNTY4ZTExMi1hNDA1LTQ1OTUtYmMyMi03NGEyMmJhZWZmYTEifQTjZNzAvce8ZFd-BCXQ7_UQOaIOFLYRoPMTgsfVsqDAS20zrFbpOiKoIfWJWWyzLVKMX5rqJI1vnzZrt9gozNQpJS9TjW1MbZ_EXTwBVYqASVy5EyXvwDpkvoV-nMHUU0EDL-p6PvQcwZDNbZU19RSep2nQ8rUG7UrvFA95n_CVTbIZPaWzb5xiDNoNpa3v3gkqM46Q3rp-spxxiF2PtWTfmPGJ49VvP43qVqauF9KVGR3edzpMA8SJS_X8Nm8UHjjHBkQQwEwHz01xaYCNXbD6BSqEm1bzBEdTem--SO-XOUAresa7A2uknDT2yzfD2O94jWGCElWz4zMH02xUlCo.NjAyMWJkZWUtMGMyOS00NmRkLThjZTMtODEyOTkzZTUyMTBi';
const AMAZON_LOCATION_STYLE_URL = `https://maps.geo.${AMAZON_LOCATION_REGION}.amazonaws.com/maps/v0/maps/${encodeURIComponent(AMAZON_LOCATION_MAP_NAME)}/style-descriptor?key=${AMAZON_LOCATION_API_KEY}`;
const AMAZON_LOCATION_FALLBACK_STYLE_URL = `https://maps.geo.${AMAZON_LOCATION_REGION}.amazonaws.com/v2/styles/Standard/descriptor?key=${AMAZON_LOCATION_API_KEY}`;

const LIGHT_THEME = {
  background: '#e2e8f0',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  text: '#0f172a',
  mutedText: '#64748b',
  secondaryText: '#475569',
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  primaryText: '#3730a3',
  chip: '#cbd5e1',
  chipText: '#334155',
  dangerSoft: '#fee2e2',
  dangerText: '#b91c1c',
  success: '#22c55e',
  border: '#94a3b8',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

const DARK_THEME = {
  background: '#020617',
  surface: '#0f172a',
  surfaceAlt: '#1e293b',
  text: '#f8fafc',
  mutedText: '#94a3b8',
  secondaryText: '#cbd5e1',
  primary: '#818cf8',
  primarySoft: '#312e81',
  primaryText: '#e0e7ff',
  chip: '#334155',
  chipText: '#cbd5e1',
  dangerSoft: '#451a1a',
  dangerText: '#fca5a5',
  success: '#22c55e',
  border: '#64748b',
  overlay: 'rgba(2, 6, 23, 0.7)',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DEFAULT_TODOS = [
  {
    id: 'tadeo-1',
    title: 'Hacer la tarea de matemáticas',
    description: 'Resolver los ejercicios del cuaderno antes de la noche.',
    completed: false,
    createdAt: '2026-03-07T08:00:00.000Z',
    location: null,
    locationCoords: null,
    reminderAt: null,
    notificationId: null,
  },
  {
    id: 'tadeo-2',
    title: 'Ordenar su cuarto',
    description: 'Guardar la ropa, acomodar la cama y dejar limpio el escritorio.',
    completed: false,
    createdAt: '2026-03-07T08:05:00.000Z',
    location: null,
    locationCoords: null,
    reminderAt: null,
    notificationId: null,
  },
  {
    id: 'tadeo-3',
    title: 'Preparar la mochila para mañana',
    description: 'Revisar cuadernos, cartuchera y botella de agua.',
    completed: false,
    createdAt: '2026-03-07T08:10:00.000Z',
    location: null,
    locationCoords: null,
    reminderAt: null,
    notificationId: null,
  },
];

const FILTERS = [
  { key: 'active', label: 'Pendientes' },
  { key: 'overdue', label: 'No completadas' },
  { key: 'done', label: 'Completadas' },
];

const DEFAULT_MAP_REGION = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SOFT_LAYOUT_ANIMATION = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

function runSoftLayoutAnimation() {
  LayoutAnimation.configureNext(SOFT_LAYOUT_ANIMATION);
}

function buildRegionFromCoords(coords, delta = 0.01) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs);
    }),
  ]);
}

function buildAmazonMapHtml(region, marker) {
  const centerLatitude = region?.latitude ?? DEFAULT_MAP_REGION.latitude;
  const centerLongitude = region?.longitude ?? DEFAULT_MAP_REGION.longitude;
  const markerLatitude = marker?.latitude ?? centerLatitude;
  const markerLongitude = marker?.longitude ?? centerLongitude;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
        <style>
          html, body, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #e2e8f0;
            overflow: hidden;
          }

          .maplibregl-ctrl-bottom-left,
          .maplibregl-ctrl-bottom-right {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
        <script>
          const styleUrls = ${JSON.stringify([AMAZON_LOCATION_STYLE_URL, AMAZON_LOCATION_FALLBACK_STYLE_URL])};
          const apiKey = ${JSON.stringify(AMAZON_LOCATION_API_KEY)};
          const initialCenter = [${centerLongitude}, ${centerLatitude}];
          const initialMarker = [${markerLongitude}, ${markerLatitude}];
          let styleIndex = 0;
          let map = null;
          let marker = null;
          let didFinishInitialLoad = false;

          function withApiKey(url) {
            if (!url || url.indexOf('amazonaws.com') === -1 || url.indexOf('key=') !== -1) {
              return url;
            }

            return url + (url.indexOf('?') === -1 ? '?' : '&') + 'key=' + encodeURIComponent(apiKey);
          }

          function postMessage(type, payload) {
            if (!window.ReactNativeWebView) {
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
          }

          function updateSelection(lngLat) {
            if (!marker) {
              return;
            }

            marker.setLngLat([lngLat.lng, lngLat.lat]);
            postMessage('select', {
              latitude: lngLat.lat,
              longitude: lngLat.lng,
            });
          }

          function createMap() {
            map = new maplibregl.Map({
              container: 'map',
              style: styleUrls[styleIndex],
              center: initialCenter,
              zoom: 15,
              transformRequest: (url) => ({
                url: withApiKey(url),
              }),
            });

            map.addControl(new maplibregl.NavigationControl(), 'top-right');

            marker = new maplibregl.Marker({ draggable: true })
              .setLngLat(initialMarker)
              .addTo(map);

            map.on('load', () => {
              didFinishInitialLoad = true;
              setTimeout(() => map.resize(), 120);
              postMessage('ready', {});
            });

            map.on('click', (event) => {
              updateSelection(event.lngLat);
            });

            marker.on('dragend', () => {
              updateSelection(marker.getLngLat());
            });

            map.on('error', (event) => {
              const message = event && event.error && event.error.message
                ? event.error.message
                : 'No se pudo cargar el mapa';

              if (!didFinishInitialLoad && styleIndex < styleUrls.length - 1) {
                styleIndex += 1;
                if (map) {
                  map.remove();
                }
                createMap();
                return;
              }

              postMessage('error', { message });
            });
          }

          try {
            createMap();

            window.onerror = function (message) {
              postMessage('error', { message: String(message || 'unknown') });
            };
          } catch (error) {
            postMessage('error', { message: String(error && error.message ? error.message : error) });
          }
        </script>
      </body>
    </html>
  `;
}

function getDefaultReminderDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

function mergeDatePart(nextDate, baseDate) {
  const merged = new Date(baseDate);
  merged.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  return merged;
}

function mergeTimePart(nextTime, baseDate) {
  const merged = new Date(baseDate);
  merged.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);
  return merged;
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value) {
  return `${formatDate(value)} a las ${formatTime(value)}`;
}

function isOverdueTodo(todo) {
  if (todo.completed || !todo.reminderAt) {
    return false;
  }

  return new Date(todo.reminderAt).getTime() < Date.now();
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.log('Error capturado en la app', error);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorSafeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>La app se recuperó de un error</Text>
            <Text style={styles.errorText}>
              Toca el botón para volver a cargar la pantalla sin que la app se cierre.
            </Text>
            <Pressable style={styles.errorButton} onPress={this.handleReset}>
              <Text style={styles.errorButtonText}>Volver a intentar</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const TodoItem = memo(function TodoItem({ item, theme, onToggle, onDelete, onEdit, isPhone62 }) {
  const completedAnimation = useRef(new Animated.Value(item.completed ? 1 : 0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const [isAnimatingToggle, setIsAnimatingToggle] = useState(false);
  const deleteAnimation = useRef(new Animated.Value(1)).current;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const hasDescription = Boolean(item.description && item.description.trim());

  useEffect(() => {
    completedAnimation.setValue(item.completed ? 1 : 0);
    slideAnimation.setValue(0);
    deleteAnimation.setValue(1);
    setIsAnimatingToggle(false);
    setIsDeleting(false);
    setIsDescriptionExpanded(false);
  }, [completedAnimation, deleteAnimation, item.completed, item.id, slideAnimation]);

  useEffect(() => {
    completedAnimation.stopAnimation();
    Animated.spring(completedAnimation, {
      toValue: item.completed ? 1 : 0,
      damping: 22,
      stiffness: 160,
      mass: 0.7,
      overshootClamping: true,
      isInteraction: false,
      useNativeDriver: true,
    }).start();
  }, [completedAnimation, item.completed]);

  function handleTogglePress() {
    if (isAnimatingToggle || isDeleting) {
      return;
    }

    setIsAnimatingToggle(true);

    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: item.completed ? -14 : 14,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.spring(completedAnimation, {
        toValue: item.completed ? 0 : 1,
        damping: 20,
        stiffness: 180,
        mass: 0.7,
        overshootClamping: true,
        isInteraction: false,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Promise.resolve(onToggle(item.id)).catch((error) => {
        console.log('No se pudo actualizar la tarea', error);
      });
      slideAnimation.setValue(0);
      setIsAnimatingToggle(false);
    });
  }

  function handleDeletePress() {
    if (isDeleting || isAnimatingToggle) {
      return;
    }

    setIsDeleting(true);

    Animated.parallel([
      Animated.timing(deleteAnimation, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: -12,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        isInteraction: false,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        Promise.resolve(onDelete(item.id)).catch((error) => {
          console.log('No se pudo borrar la tarea', error);
          deleteAnimation.setValue(1);
          slideAnimation.setValue(0);
          setIsDeleting(false);
        });
      } else {
        deleteAnimation.setValue(1);
        slideAnimation.setValue(0);
        setIsDeleting(false);
      }
    });
  }

  function handleContentPress() {
    if (!hasDescription || isDeleting || isAnimatingToggle) {
      return;
    }

    runSoftLayoutAnimation();
    setIsDescriptionExpanded((current) => !current);
  }

  const checkAnimatedStyle = {
    transform: [
      {
        scale: completedAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.12],
        }),
      },
    ],
  };

  const contentAnimatedStyle = {
    opacity: Animated.multiply(
      deleteAnimation,
      completedAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88],
      }),
    ),
    transform: [
      {
        translateX: slideAnimation,
      },
      {
        translateY: completedAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
      {
        scale: deleteAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
      {
        scaleY: deleteAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.65, 1],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.todoCard,
        isPhone62 && styles.todoCardPhone62,
        { backgroundColor: theme.surface },
        contentAnimatedStyle,
      ]}
    >
      <Pressable
        style={[
          styles.checkCircle,
          isPhone62 && styles.checkCirclePhone62,
          { borderColor: theme.border },
          item.completed && [styles.checkCircleDone, { backgroundColor: theme.success, borderColor: theme.success }],
        ]}
        onPress={handleTogglePress}
      >
        <Animated.View style={checkAnimatedStyle}>
          <Text style={styles.checkMark}>{item.completed ? '✓' : ''}</Text>
        </Animated.View>
      </Pressable>

      <Pressable style={styles.todoContent} onPress={handleContentPress}>
        <Text
          style={[
            styles.todoTitle,
            isPhone62 && styles.todoTitlePhone62,
            { color: theme.text },
            item.completed && [styles.todoTitleDone, { color: theme.mutedText }],
          ]}
        >
          {item.title}
        </Text>
        <Text style={[styles.todoMeta, isPhone62 && styles.todoMetaPhone62, { color: theme.mutedText }]}>
          {item.completed ? 'Completada' : isOverdueTodo(item) ? 'No completada' : 'Pendiente'}
        </Text>
        {hasDescription ? (
          <Text style={[styles.todoExpandHint, isPhone62 && styles.todoExpandHintPhone62, { color: theme.mutedText }]}>
            {isDescriptionExpanded ? 'Ocultar descripción' : 'Toca el nombre para ver la descripción'}
          </Text>
        ) : null}
        {hasDescription && isDescriptionExpanded ? (
          <Text style={[styles.todoDescription, isPhone62 && styles.todoDescriptionPhone62, { color: theme.secondaryText }]}>
            {item.description}
          </Text>
        ) : null}
        {item.location ? (
          <Text style={[styles.todoLocation, isPhone62 && styles.todoLocationPhone62, { color: theme.secondaryText }]}>
            📍 Ubicación: {item.location}
          </Text>
        ) : null}
        {item.locationCoords ? (
          <Text style={[styles.todoCoords, isPhone62 && styles.todoCoordsPhone62, { color: theme.mutedText }]}>
            Lat {item.locationCoords.latitude.toFixed(4)} · Lon {item.locationCoords.longitude.toFixed(4)}
          </Text>
        ) : null}
        {item.reminderAt ? (
          <Text style={[styles.todoReminder, isPhone62 && styles.todoReminderPhone62, { color: theme.primary }]}>
            Recordatorio: {formatDateTime(item.reminderAt)}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.todoActions}>
        <Pressable
          style={[styles.editButton, isPhone62 && styles.editButtonPhone62, { backgroundColor: theme.primarySoft }]}
          onPress={() => onEdit(item)}
        >
          <Text style={[styles.editButtonText, isPhone62 && styles.editButtonTextPhone62, { color: theme.primaryText }]}>Editar</Text>
        </Pressable>

        <Pressable
          style={[styles.deleteButton, isPhone62 && styles.deleteButtonPhone62, { backgroundColor: theme.dangerSoft }]}
          onPress={handleDeletePress}
        >
          <Text style={[styles.deleteButtonText, isPhone62 && styles.deleteButtonTextPhone62, { color: theme.dangerText }]}>Borrar</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

function TodoApp() {
  const { width, height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState('active');
  const [showComposer, setShowComposer] = useState(false);
  const [shouldRenderComposer, setShouldRenderComposer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shouldRenderSettings, setShouldRenderSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [shouldRenderEditModal, setShouldRenderEditModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapHtml, setMapHtml] = useState('');
  const [mapRegion, setMapRegion] = useState(DEFAULT_MAP_REGION);
  const [draftLocationCoords, setDraftLocationCoords] = useState(null);
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapSearchResultLabel, setMapSearchResultLabel] = useState('');
  const [mapPickerTarget, setMapPickerTarget] = useState('create');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLocationCoords, setEditLocationCoords] = useState(null);
  const [editReminderAt, setEditReminderAt] = useState(null);
  const [editCompleted, setEditCompleted] = useState(false);
  const [reminderAt, setReminderAt] = useState(null);
  const [hasLoadedTodos, setHasLoadedTodos] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isResolvingMapLocation, setIsResolvingMapLocation] = useState(false);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isFilterTransitioning, setIsFilterTransitioning] = useState(false);
  const composerAnimation = useRef(new Animated.Value(0)).current;
  const settingsAnimation = useRef(new Animated.Value(0)).current;
  const editModalAnimation = useRef(new Animated.Value(0)).current;
  const filterContentAnimation = useRef(new Animated.Value(1)).current;

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const isPhone62 = width <= 430 && height <= 950;
  const isCompact = width < 430 || height < 900;
  const isVeryCompact = width < 340;
  const shouldStackFilters = width < 480 || showComposer;
  const dynamicTitleStyle = {
    fontSize: width < 360 ? 26 : width < 430 ? 30 : 36,
    lineHeight: width < 360 ? 30 : width < 430 ? 34 : 40,
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    loadTodos();
    loadSettings();
    initializeNotifications();
  }, []);

  useEffect(() => {
    if (!hasLoadedTodos) {
      return;
    }

    saveTodos(todos);
  }, [hasLoadedTodos, todos]);

  useEffect(() => {
    if (!hasLoadedTodos) {
      return;
    }

    syncPendingSummaryReminders(todos);
  }, [hasLoadedTodos, todos]);

  useEffect(() => {
    if (!hasLoadedSettings) {
      return;
    }

    saveSettings(isDarkMode);
  }, [hasLoadedSettings, isDarkMode]);

  useEffect(() => {
    if (showComposer) {
      setShouldRenderComposer(true);
      composerAnimation.stopAnimation();
      Animated.spring(composerAnimation, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        mass: 0.8,
        stiffness: 170,
        overshootClamping: true,
        isInteraction: false,
      }).start();
      return;
    }

    composerAnimation.stopAnimation();
    Animated.timing(composerAnimation, {
      toValue: 0,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      isInteraction: false,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderComposer(false);
      }
    });
  }, [composerAnimation, showComposer]);

  useEffect(() => {
    if (showSettings) {
      setShouldRenderSettings(true);
      settingsAnimation.stopAnimation();
      Animated.spring(settingsAnimation, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        mass: 0.82,
        stiffness: 170,
        overshootClamping: true,
        isInteraction: false,
      }).start();
      return;
    }

    settingsAnimation.stopAnimation();
    Animated.timing(settingsAnimation, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      isInteraction: false,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderSettings(false);
      }
    });
  }, [settingsAnimation, showSettings]);

  useEffect(() => {
    if (showEditModal) {
      setShouldRenderEditModal(true);
      editModalAnimation.stopAnimation();
      Animated.spring(editModalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        mass: 0.82,
        stiffness: 170,
        overshootClamping: true,
        isInteraction: false,
      }).start();
      return;
    }

    editModalAnimation.stopAnimation();
    Animated.timing(editModalAnimation, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      isInteraction: false,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderEditModal(false);
      }
    });
  }, [editModalAnimation, showEditModal]);

  async function initializeNotifications() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
          name: 'Recordatorios',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4f46e5',
        });
      }

      const settings = await Notifications.getPermissionsAsync();

      if (!settings.granted) {
        await Notifications.requestPermissionsAsync();
      }
    } catch (error) {
      console.log('No se pudieron configurar las notificaciones', error);
    }
  }

  async function loadTodos() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedTodos = JSON.parse(saved).map((todo) => ({
          description: null,
          location: null,
          locationCoords: null,
          reminderAt: null,
          notificationId: null,
          ...todo,
        }));

        setTodos(parsedTodos);
      } else {
        setTodos(DEFAULT_TODOS);
      }
    } catch (error) {
      console.log('No se pudieron cargar las tareas', error);
      setTodos(DEFAULT_TODOS);
    } finally {
      setHasLoadedTodos(true);
    }
  }

  async function loadSettings() {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);

      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setIsDarkMode(Boolean(parsedSettings.isDarkMode));
      }
    } catch (error) {
      console.log('No se pudieron cargar las opciones', error);
    } finally {
      setHasLoadedSettings(true);
    }
  }

  async function saveSettings(nextIsDarkMode) {
    try {
      await AsyncStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ isDarkMode: nextIsDarkMode }),
      );
    } catch (error) {
      console.log('No se pudieron guardar las opciones', error);
    }
  }

  async function saveTodos(nextTodos) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTodos));
    } catch (error) {
      console.log('No se pudieron guardar las tareas', error);
    }
  }

  async function scheduleReminder(todoTitle, reminderDate, todoLocation = '') {
    const cleanLocation = todoLocation.trim();
    const triggerDate = reminderDate instanceof Date ? reminderDate : new Date(reminderDate);
    const secondsUntilReminder = Math.max(
      1,
      Math.round((triggerDate.getTime() - Date.now()) / 1000),
    );

    let settings = await Notifications.getPermissionsAsync();

    if (!settings.granted) {
      settings = await Notifications.requestPermissionsAsync();
    }

    if (!settings.granted) {
      throw new Error('notification-permission-denied');
    }

    const trigger = {
      channelId: NOTIFICATION_CHANNEL_ID,
      seconds: secondsUntilReminder,
      repeats: false,
    };

    const nextTriggerDate = await Notifications.getNextTriggerDateAsync(trigger);

    if (!nextTriggerDate) {
      throw new Error('invalid-notification-trigger');
    }

    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio',
        body: cleanLocation
          ? `Tienes pendiente: ${todoTitle} en ${cleanLocation}`
          : `Tienes pendiente: ${todoTitle}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
      trigger,
    });
  }

  async function syncPendingSummaryReminders(currentTodos) {
    try {
      let settings = await Notifications.getPermissionsAsync();

      if (!settings.granted) {
        settings = await Notifications.requestPermissionsAsync();
      }

      if (!settings.granted) {
        return;
      }

      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const summaryNotifications = scheduledNotifications.filter(
        (notification) => notification.content?.data?.kind === PENDING_SUMMARY_NOTIFICATION_KIND,
      );

      await Promise.all(
        summaryNotifications.map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier),
        ),
      );

      const pendingTodos = currentTodos.filter((todo) => !todo.completed);

      if (!pendingTodos.length) {
        return;
      }

      const overdueCount = pendingTodos.filter((todo) => isOverdueTodo(todo)).length;
      const body = overdueCount
        ? `Tienes ${pendingTodos.length} tareas pendientes y ${overdueCount} ya vencidas.`
        : `Todavía tienes ${pendingTodos.length} tareas pendientes por revisar.`;

      await Promise.all(
        PENDING_SUMMARY_TIMES.map(({ hour, minute }) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'No olvides tus tareas',
              body,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.DEFAULT,
              channelId: NOTIFICATION_CHANNEL_ID,
              data: {
                kind: PENDING_SUMMARY_NOTIFICATION_KIND,
              },
            },
            trigger: {
              channelId: NOTIFICATION_CHANNEL_ID,
              hour,
              minute,
              repeats: true,
            },
          }),
        ),
      );
    } catch (error) {
      console.log('No se pudieron sincronizar los recordatorios generales', error);
    }
  }

  async function cancelReminder(notificationId) {
    if (!notificationId) {
      return;
    }

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.log('No se pudo cancelar el recordatorio', error);
    }
  }

  async function addTodo() {
    const cleanText = text.trim();
    const cleanDescription = description.trim();
    const cleanLocation = location.trim();

    if (!cleanText) {
      Alert.alert('Escribe una tarea', 'Agrega un texto antes de guardar.');
      return;
    }

    if (reminderAt && reminderAt.getTime() <= Date.now()) {
      Alert.alert('Fecha inválida', 'El recordatorio debe ser una fecha futura.');
      return;
    }

    let notificationId = null;
    let reminderWasSkipped = false;

    try {
      if (reminderAt) {
        try {
          notificationId = await scheduleReminder(cleanText, reminderAt, cleanLocation);
        } catch (error) {
          console.log('No se pudo programar el recordatorio', error);
          reminderWasSkipped = true;
        }
      }

      const newTodo = {
        id: Date.now().toString(),
        title: cleanText,
        description: cleanDescription || null,
        completed: false,
        createdAt: new Date().toISOString(),
        location: cleanLocation || null,
        locationCoords,
        reminderAt: reminderAt ? reminderAt.toISOString() : null,
        notificationId,
      };

      runSoftLayoutAnimation();
      setTodos((current) => [newTodo, ...current]);
      setText('');
      setDescription('');
      setLocation('');
      setLocationCoords(null);
      setReminderAt(null);
      setShowComposer(false);

      if (reminderWasSkipped) {
        Alert.alert(
          'Tarea guardada',
          'La tarea se creó, pero el recordatorio no se activó. Revisa los permisos de notificaciones.',
        );
      }
    } catch (error) {
      console.log('No se pudo crear la tarea con recordatorio', error);
      Alert.alert('No se pudo guardar', 'Vuelve a intentarlo.');
    }
  }

  const toggleTodo = useCallback(async (id) => {
    const selectedTodo = todos.find((todo) => todo.id === id);

    if (!selectedTodo) {
      return;
    }

    let nextNotificationId = selectedTodo.notificationId ?? null;

    if (!selectedTodo.completed) {
      await cancelReminder(selectedTodo.notificationId);
      nextNotificationId = null;
    } else if (selectedTodo.reminderAt) {
      const reminderDate = new Date(selectedTodo.reminderAt);

      if (reminderDate.getTime() > Date.now()) {
        try {
          nextNotificationId = await scheduleReminder(
            selectedTodo.title,
            reminderDate,
            selectedTodo.location ?? '',
          );
        } catch (error) {
          console.log('No se pudo reactivar el recordatorio', error);
          nextNotificationId = null;
        }
      }
    }

    runSoftLayoutAnimation();
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, completed: !todo.completed, notificationId: nextNotificationId }
          : todo,
      ),
    );
  }, [todos]);

  const deleteTodo = useCallback(async (id) => {
    const selectedTodo = todos.find((todo) => todo.id === id);

    await cancelReminder(selectedTodo?.notificationId);
    runSoftLayoutAnimation();
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }, [todos]);

  const clearCompleted = useCallback(() => {
    const completedTodos = todos.filter((todo) => todo.completed);

    if (!completedTodos.length) {
      Alert.alert('Nada para limpiar', 'No hay tareas completadas.');
      return;
    }

    Alert.alert(
      'Eliminar completadas',
      `Se eliminarán ${completedTodos.length} tareas completadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await Promise.all(
              completedTodos.map((todo) => cancelReminder(todo.notificationId)),
            );
            runSoftLayoutAnimation();
            setTodos((current) => current.filter((todo) => !todo.completed));
          },
        },
      ],
    );
  }, [todos]);

  function openDatePicker(target = 'create') {
    const isEditingTarget = target === 'edit';
    const baseDate = isEditingTarget ? editReminderAt ?? getDefaultReminderDate() : reminderAt ?? getDefaultReminderDate();

    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) {
          return;
        }

        if (isEditingTarget) {
          setEditReminderAt((current) => mergeDatePart(selectedDate, current ?? baseDate));
          return;
        }

        setReminderAt((current) => mergeDatePart(selectedDate, current ?? baseDate));
      },
    });
  }

  function openTimePicker(target = 'create') {
    const isEditingTarget = target === 'edit';
    const baseDate = isEditingTarget ? editReminderAt ?? getDefaultReminderDate() : reminderAt ?? getDefaultReminderDate();

    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'time',
      is24Hour: true,
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) {
          return;
        }

        if (isEditingTarget) {
          setEditReminderAt((current) => mergeTimePart(selectedDate, current ?? baseDate));
          return;
        }

        setReminderAt((current) => mergeTimePart(selectedDate, current ?? baseDate));
      },
    });
  }

  function handleLocationChange(value, target = 'create') {
    if (target === 'edit') {
      setEditLocation(value);
      setEditLocationCoords(null);
      return;
    }

    setLocation(value);
    setLocationCoords(null);
  }

  async function useCurrentLocation(target = 'create') {
    try {
      setIsGettingLocation(true);

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permiso necesario', 'Activa la ubicación para usar tu posición real.');
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      const places = await Location.reverseGeocodeAsync(coords);
      const place = places[0];
      const label = place
        ? [place.name, place.street, place.district, place.city]
            .filter(Boolean)
            .join(', ')
        : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

      if (target === 'edit') {
        setEditLocation(label);
        setEditLocationCoords(coords);
      } else {
        setLocation(label);
        setLocationCoords(coords);
      }
    } catch (error) {
      console.log('No se pudo obtener la ubicación real', error);
      Alert.alert('Ubicación no disponible', 'No se pudo obtener tu ubicación actual.');
    } finally {
      setIsGettingLocation(false);
    }
  }

  async function getCurrentCoordsForMap() {
    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        return null;
      }

      const lastKnownPosition = await Location.getLastKnownPositionAsync();

      if (lastKnownPosition?.coords) {
        return {
          latitude: lastKnownPosition.coords.latitude,
          longitude: lastKnownPosition.coords.longitude,
        };
      }

      const currentPosition = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        MAP_LOCATION_TIMEOUT_MS,
      );

      return {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };
    } catch (error) {
      console.log('No se pudo centrar el mapa en la ubicación actual', error);
      return null;
    }
  }

  async function resolveInitialMapRegion(target = 'create') {
    const targetLocationCoords = target === 'edit' ? editLocationCoords : locationCoords;
    const targetLocation = target === 'edit' ? editLocation : location;

    if (draftLocationCoords) {
      return buildRegionFromCoords(draftLocationCoords);
    }

    const currentCoords = await getCurrentCoordsForMap();

    if (currentCoords) {
      return buildRegionFromCoords(currentCoords);
    }

    if (targetLocationCoords) {
      return buildRegionFromCoords(targetLocationCoords);
    }

    const cleanLocation = targetLocation.trim();

    if (cleanLocation) {
      try {
        const geocoded = await Location.geocodeAsync(cleanLocation);

        if (geocoded.length) {
          return buildRegionFromCoords({
            latitude: geocoded[0].latitude,
            longitude: geocoded[0].longitude,
          });
        }
      } catch (error) {
        console.log('No se pudo ubicar la dirección escrita', error);
      }
    }

    if (mapRegion?.latitude && mapRegion?.longitude) {
      return mapRegion;
    }

    return DEFAULT_MAP_REGION;
  }

  async function openMapPicker(target = 'create') {
    const targetLocationCoords = target === 'edit' ? editLocationCoords : locationCoords;
    const targetLocation = target === 'edit' ? editLocation : location;
    const fallbackCoords = draftLocationCoords ?? targetLocationCoords;

    try {
      setIsResolvingMapLocation(true);
      setMapPickerTarget(target);
      const initialRegion = await resolveInitialMapRegion(target);
      const initialCoords = fallbackCoords ?? {
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      };

      setMapRegion(initialRegion);
      setDraftLocationCoords(initialCoords);
      setMapSearchText(targetLocation.trim());
      setMapSearchResultLabel(targetLocation.trim());
      setMapHtml(buildAmazonMapHtml(initialRegion, initialCoords));
      setShowMapPicker(true);
    } catch (error) {
      console.log('No se pudo abrir el mapa', error);
      Alert.alert(
        'Mapa abierto con ubicación general',
        'No se pudo centrar automáticamente, pero ya puedes elegir el lugar en el mapa.',
      );
    } finally {
      setIsResolvingMapLocation(false);
    }
  }

  function closeMapPicker() {
    setShowMapPicker(false);
    setMapHtml('');
    setMapSearchResultLabel('');
  }

  function handleMapMessage(event) {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === 'select') {
        const coords = {
          latitude: payload.latitude,
          longitude: payload.longitude,
        };

        setDraftLocationCoords(coords);
        setMapRegion(buildRegionFromCoords(coords));
        setMapSearchResultLabel('');
      }

      if (payload.type === 'error') {
        console.log('No se pudo cargar el mapa de Amazon', payload.message);
      }
    } catch (error) {
      console.log('No se pudo leer el evento del mapa', error);
    }
  }

  async function saveMapLocation() {
    if (!draftLocationCoords) {
      return;
    }

    try {
      const places = await Location.reverseGeocodeAsync(draftLocationCoords);
      const place = places[0];
      const label = place
        ? [place.name, place.street, place.district, place.city]
            .filter(Boolean)
            .join(', ')
        : `${draftLocationCoords.latitude.toFixed(5)}, ${draftLocationCoords.longitude.toFixed(5)}`;

      if (mapPickerTarget === 'edit') {
        setEditLocation(label);
        setEditLocationCoords(draftLocationCoords);
      } else {
        setLocation(label);
        setLocationCoords(draftLocationCoords);
      }
      closeMapPicker();
    } catch (error) {
      console.log('No se pudo guardar la ubicación del mapa', error);
      Alert.alert('No se pudo guardar', 'Selecciona otro punto o vuelve a intentarlo.');
    }
  }

  async function searchMapLocation() {
    const query = mapSearchText.trim();

    if (!query) {
      Alert.alert('Escribe una ubicación', 'Pon un nombre o dirección para buscarla en el mapa.');
      return;
    }

    try {
      setIsSearchingMap(true);
      const results = await Location.geocodeAsync(query);

      if (!results.length) {
        Alert.alert('Sin resultados', 'No encontré esa ubicación. Prueba con otro nombre o dirección.');
        return;
      }

      const nextCoords = {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
      const nextRegion = buildRegionFromCoords(nextCoords);

      setDraftLocationCoords(nextCoords);
      setMapRegion(nextRegion);
      setMapSearchResultLabel(query);
      setMapHtml(buildAmazonMapHtml(nextRegion, nextCoords));
    } catch (error) {
      console.log('No se pudo buscar la ubicación en el mapa', error);
      Alert.alert('Búsqueda no disponible', 'No se pudo buscar esa ubicación ahora mismo.');
    } finally {
      setIsSearchingMap(false);
    }
  }

  function openEditTodo(todo) {
    setEditingTodoId(todo.id);
    setEditText(todo.title ?? '');
    setEditDescription(todo.description ?? '');
    setEditLocation(todo.location ?? '');
    setEditLocationCoords(todo.locationCoords ?? null);
    setEditReminderAt(todo.reminderAt ? new Date(todo.reminderAt) : null);
    setEditCompleted(Boolean(todo.completed));
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
  }

  async function saveEditedTodo() {
    const cleanText = editText.trim();
    const cleanDescription = editDescription.trim();
    const cleanLocation = editLocation.trim();
    const selectedTodo = todos.find((todo) => todo.id === editingTodoId);

    if (!selectedTodo) {
      return;
    }

    if (!cleanText) {
      Alert.alert('Escribe una tarea', 'El nombre de la tarea no puede quedar vacío.');
      return;
    }

    if (editReminderAt && editReminderAt.getTime() <= Date.now() && !editCompleted) {
      Alert.alert('Fecha inválida', 'El recordatorio debe ser una fecha futura o marca la tarea como completada.');
      return;
    }

    let nextNotificationId = null;

    try {
      await cancelReminder(selectedTodo.notificationId);

      if (editReminderAt && !editCompleted && editReminderAt.getTime() > Date.now()) {
        try {
          nextNotificationId = await scheduleReminder(cleanText, editReminderAt, cleanLocation);
        } catch (error) {
          console.log('No se pudo actualizar el recordatorio', error);
          nextNotificationId = null;
        }
      }

      runSoftLayoutAnimation();
      setTodos((current) =>
        current.map((todo) =>
          todo.id === editingTodoId
            ? {
                ...todo,
                title: cleanText,
                description: cleanDescription || null,
                location: cleanLocation || null,
                locationCoords: editLocationCoords,
                reminderAt: editReminderAt ? editReminderAt.toISOString() : null,
                completed: editCompleted,
                notificationId: nextNotificationId,
              }
            : todo,
        ),
      );
      closeEditModal();
    } catch (error) {
      console.log('No se pudo editar la tarea', error);
      Alert.alert('No se pudo guardar', 'Vuelve a intentarlo.');
    }
  }

  function toggleComposer() {
    runSoftLayoutAnimation();
    setShowComposer((current) => !current);
  }

  function openSettings() {
    setShowSettings(true);
  }

  function closeSettings() {
    setShowSettings(false);
  }

  function handleFilterChange(nextFilter) {
    if (nextFilter === filter || isFilterTransitioning) {
      return;
    }

    setIsFilterTransitioning(true);
    filterContentAnimation.stopAnimation();

    Animated.timing(filterContentAnimation, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.quad),
      isInteraction: false,
      useNativeDriver: true,
    }).start(() => {
      runSoftLayoutAnimation();
      setFilter(nextFilter);

      Animated.spring(filterContentAnimation, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        mass: 0.75,
        stiffness: 170,
        overshootClamping: true,
        isInteraction: false,
      }).start(() => {
        setIsFilterTransitioning(false);
      });
    });
  }

  const composerAnimatedStyle = {
    opacity: composerAnimation,
    transform: [
      {
        translateY: composerAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: composerAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.992, 1],
        }),
      },
    ],
  };

  const settingsOverlayAnimatedStyle = {
    opacity: settingsAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  const settingsCardAnimatedStyle = {
    opacity: settingsAnimation,
    transform: [
      {
        translateY: settingsAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: settingsAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  const editOverlayAnimatedStyle = {
    opacity: editModalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  const editCardAnimatedStyle = {
    opacity: editModalAnimation,
    transform: [
      {
        translateY: editModalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: editModalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  const filterContentAnimatedStyle = {
    opacity: filterContentAnimation,
    transform: [
      {
        translateY: filterContentAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 0],
        }),
      },
      {
        scale: filterContentAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.992, 1],
        }),
      },
    ],
  };

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter((todo) => !todo.completed);
      case 'overdue':
        return todos.filter((todo) => isOverdueTodo(todo));
      case 'done':
        return todos.filter((todo) => todo.completed);
      default:
        return todos.filter((todo) => !todo.completed);
    }
  }, [filter, todos]);

  const pendingCount = todos.filter((todo) => !todo.completed).length;
  const overdueCount = todos.filter((todo) => isOverdueTodo(todo)).length;
  const completedCount = todos.filter((todo) => todo.completed).length;
  const listHeader = (
    <>
      <View style={[styles.header, isPhone62 && styles.headerPhone62]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { color: theme.text },
              dynamicTitleStyle,
            ]}
          >
            Cosas que tengo que hacer
          </Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.summaryRow,
          filterContentAnimatedStyle,
          isCompact && styles.summaryRowCompact,
        ]}
      >
        <Text style={[styles.summaryText, isPhone62 && styles.summaryTextPhone62, { color: theme.text }]}>
          {filter === 'overdue'
            ? `${overdueCount} no completadas`
            : filter === 'done'
              ? `${completedCount} completadas`
              : `${pendingCount} pendientes`}
        </Text>
        {filter === 'done' ? (
          <Pressable onPress={clearCompleted}>
            <Text style={[styles.clearText, { color: theme.dangerText }]}>Limpiar completadas</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <View style={[styles.filterSection, (isCompact || shouldStackFilters) && styles.filterSectionCompact]}>
        <View
          style={[
            styles.filterGroup,
            (isCompact || shouldStackFilters) && styles.filterGroupCompact,
            (isPhone62 || shouldStackFilters) && styles.filterGroupPhone62,
          ]}
        >
          {FILTERS.map((item) => {
            const selected = item.key === filter;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.filterButton,
                  (isPhone62 || shouldStackFilters) && styles.filterButtonPhone62,
                  { backgroundColor: theme.chip },
                  !selected && { borderColor: theme.border, borderWidth: 1 },
                  selected && [styles.filterButtonActive, { backgroundColor: theme.text }],
                  isVeryCompact && styles.filterButtonCompact,
                ]}
                onPress={() => handleFilterChange(item.key)}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.filterButtonText,
                    (isPhone62 || shouldStackFilters) && styles.filterButtonTextPhone62,
                    { color: theme.text },
                    selected && [styles.filterButtonTextActive, { color: theme.background }],
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.filterActionsStandalone,
            (isCompact || shouldStackFilters) && styles.filterActionsStandaloneCompact,
          ]}
        >
          <Pressable
            style={[styles.titleAddButton, styles.filterActionButton, { backgroundColor: theme.primary }]}
            onPress={toggleComposer}
          >
            <Text style={styles.titleAddButtonText}>{showComposer ? '−' : '+'}</Text>
          </Pressable>

          <Pressable
            style={[styles.settingsButton, styles.filterActionButton, { backgroundColor: theme.surface }]}
            onPress={openSettings}
          >
            <Text style={[styles.settingsButtonText, { color: theme.text }]}>⚙</Text>
          </Pressable>
        </View>

        {shouldRenderComposer ? (
          <Animated.View
            style={[
              styles.inputCard,
              styles.composerBelowActions,
              isPhone62 && styles.inputCardPhone62,
              { backgroundColor: theme.surface },
              composerAnimatedStyle,
            ]}
          >
            <View style={[styles.inputRow, isCompact && styles.inputRowCompact]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Escribe una tarea..."
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.input,
                  isPhone62 && styles.inputPhone62,
                  { backgroundColor: theme.surfaceAlt, color: theme.text },
                ]}
                returnKeyType="done"
                onSubmitEditing={addTodo}
              />
              <Pressable
                style={[
                  styles.addButton,
                  isPhone62 && styles.addButtonPhone62,
                  { backgroundColor: theme.primary },
                  isCompact && styles.addButtonCompact,
                ]}
                onPress={addTodo}
              >
                <Text style={[styles.addButtonText, isPhone62 && styles.addButtonTextPhone62]}>Agregar</Text>
              </Pressable>
            </View>

            <View style={styles.descriptionSection}>
              <Text style={[styles.locationLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Descripción</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Añade más detalles para esta tarea"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.descriptionInput,
                  isPhone62 && styles.descriptionInputPhone62,
                  { backgroundColor: theme.surfaceAlt, color: theme.text },
                ]}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.locationSection}>
              <Text style={[styles.locationLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Ubicación</Text>
              <TextInput
                value={location}
                onChangeText={handleLocationChange}
                placeholder="Ejemplo: colegio, gimnasio o casa"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.locationInput,
                  isPhone62 && styles.locationInputPhone62,
                  { backgroundColor: theme.surfaceAlt, color: theme.text },
                ]}
              />
              <Pressable
                style={[
                  styles.currentLocationButton,
                  isPhone62 && styles.currentLocationButtonPhone62,
                  { backgroundColor: theme.primarySoft },
                  isGettingLocation && styles.currentLocationButtonDisabled,
                ]}
                onPress={useCurrentLocation}
                disabled={isGettingLocation}
              >
                <Text style={[styles.currentLocationButtonText, isPhone62 && styles.currentLocationButtonTextPhone62, { color: theme.primaryText }]}> 
                  {isGettingLocation ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.currentLocationButton,
                  isPhone62 && styles.currentLocationButtonPhone62,
                  { backgroundColor: theme.surfaceAlt },
                  isResolvingMapLocation && styles.currentLocationButtonDisabled,
                ]}
                onPress={openMapPicker}
                disabled={isResolvingMapLocation}
              >
                <Text style={[styles.currentLocationButtonText, isPhone62 && styles.currentLocationButtonTextPhone62, { color: theme.text }]}> 
                  {isResolvingMapLocation ? 'Abriendo mapa...' : 'Elegir ubicación en el mapa'}
                </Text>
              </Pressable>
              <Text style={[styles.locationHint, isPhone62 && styles.locationHintPhone62, { color: theme.mutedText }]}> 
                Agrégala si esta tarea requiere ir a un lugar o usa tu ubicación real.
              </Text>
            </View>

            <View style={styles.reminderSection}>
              <Text style={[styles.reminderLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Fecha y hora del recordatorio</Text>

              <View style={[styles.reminderButtonsRow, isCompact && styles.reminderButtonsRowCompact]}>
                <Pressable
                  style={[
                    styles.reminderButton,
                    isPhone62 && styles.reminderButtonPhone62,
                    { backgroundColor: theme.primarySoft },
                    isCompact && styles.reminderButtonCompact,
                  ]}
                  onPress={openDatePicker}
                >
                  <Text style={[styles.reminderButtonText, isPhone62 && styles.reminderButtonTextPhone62, { color: theme.primaryText }]}> 
                    {reminderAt ? formatDate(reminderAt) : 'Elegir fecha'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.reminderButton,
                    isPhone62 && styles.reminderButtonPhone62,
                    { backgroundColor: theme.primarySoft },
                    isCompact && styles.reminderButtonCompact,
                  ]}
                  onPress={openTimePicker}
                >
                  <Text style={[styles.reminderButtonText, isPhone62 && styles.reminderButtonTextPhone62, { color: theme.primaryText }]}> 
                    {reminderAt ? formatTime(reminderAt) : 'Elegir hora'}
                  </Text>
                </Pressable>
              </View>

              {reminderAt ? (
                <View style={[styles.reminderPreviewRow, isPhone62 && styles.reminderPreviewRowPhone62]}>
                  <Text style={[styles.reminderPreviewText, isPhone62 && styles.reminderPreviewTextPhone62, { color: theme.secondaryText }]}> 
                    Recordatorio: {formatDateTime(reminderAt)}
                  </Text>
                  <Pressable onPress={() => setReminderAt(null)}>
                    <Text style={[styles.reminderClearText, { color: theme.dangerText }]}>Quitar</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.reminderHint, { color: theme.mutedText }]}> 
                  Si eliges fecha y hora, la app te enviará una notificación.
                </Text>
              )}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={[
          styles.container,
          isPhone62 && styles.containerPhone62,
          isCompact && styles.containerCompact,
          {
            backgroundColor: theme.background,
            paddingTop: Platform.OS === 'android' ? (height < 780 ? 34 : 42) : 12,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Modal
          visible={shouldRenderSettings}
          transparent
          animationType="fade"
          onRequestClose={closeSettings}
        >
          <Animated.View
            style={[
              styles.modalOverlay,
              isPhone62 && styles.modalOverlayPhone62,
              { backgroundColor: theme.overlay },
              settingsOverlayAnimatedStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.modalCard,
                isPhone62 && styles.modalCardPhone62,
                { backgroundColor: theme.surface },
                settingsCardAnimatedStyle,
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Opciones</Text>
              <View style={[styles.optionRow, { borderBottomColor: theme.surfaceAlt }]}> 
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Cambiar modo</Text>
                  <Text style={[styles.optionSubtitle, { color: theme.mutedText }]}>Modo oscuro</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={setIsDarkMode}
                  trackColor={{ false: '#94a3b8', true: theme.primary }}
                  thumbColor="#ffffff"
                />
              </View>

              <Pressable
                style={[styles.modalCloseButton, { backgroundColor: theme.primarySoft }]}
                onPress={closeSettings}
              >
                <Text style={[styles.modalCloseButtonText, { color: theme.primaryText }]}>Cerrar</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Modal>

        <Modal
          visible={shouldRenderEditModal}
          transparent
          animationType="fade"
          onRequestClose={closeEditModal}
        >
          <Animated.View
            style={[
              styles.modalOverlay,
              isPhone62 && styles.modalOverlayPhone62,
              { backgroundColor: theme.overlay },
              editOverlayAnimatedStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.modalCard,
                styles.editModalCard,
                isPhone62 && styles.modalCardPhone62,
                isPhone62 && styles.editModalCardPhone62,
                { backgroundColor: theme.surface },
                editCardAnimatedStyle,
              ]}
            >
              <Text style={[styles.modalTitle, isPhone62 && styles.modalTitlePhone62, { color: theme.text }]}>Editar tarea</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.editScrollContent}
              >
                <View style={[styles.inputRow, isCompact && styles.inputRowCompact]}>
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Escribe una tarea..."
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      isPhone62 && styles.inputPhone62,
                      { backgroundColor: theme.surfaceAlt, color: theme.text },
                    ]}
                    returnKeyType="done"
                    onSubmitEditing={saveEditedTodo}
                  />
                </View>

                <View style={styles.descriptionSection}>
                  <Text style={[styles.locationLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Descripción</Text>
                  <TextInput
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Añade más detalles para esta tarea"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.descriptionInput,
                      isPhone62 && styles.descriptionInputPhone62,
                      { backgroundColor: theme.surfaceAlt, color: theme.text },
                    ]}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.locationSection}>
                  <Text style={[styles.locationLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Ubicación</Text>
                  <TextInput
                    value={editLocation}
                    onChangeText={(value) => handleLocationChange(value, 'edit')}
                    placeholder="Ejemplo: colegio, gimnasio o casa"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.locationInput,
                      isPhone62 && styles.locationInputPhone62,
                      { backgroundColor: theme.surfaceAlt, color: theme.text },
                    ]}
                  />
                  <Pressable
                    style={[
                      styles.currentLocationButton,
                      isPhone62 && styles.currentLocationButtonPhone62,
                      { backgroundColor: theme.primarySoft },
                      isGettingLocation && styles.currentLocationButtonDisabled,
                    ]}
                    onPress={() => useCurrentLocation('edit')}
                    disabled={isGettingLocation}
                  >
                    <Text style={[styles.currentLocationButtonText, isPhone62 && styles.currentLocationButtonTextPhone62, { color: theme.primaryText }]}> 
                      {isGettingLocation ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.currentLocationButton,
                      isPhone62 && styles.currentLocationButtonPhone62,
                      { backgroundColor: theme.surfaceAlt },
                      isResolvingMapLocation && styles.currentLocationButtonDisabled,
                    ]}
                    onPress={() => openMapPicker('edit')}
                    disabled={isResolvingMapLocation}
                  >
                    <Text style={[styles.currentLocationButtonText, isPhone62 && styles.currentLocationButtonTextPhone62, { color: theme.text }]}> 
                      {isResolvingMapLocation ? 'Abriendo mapa...' : 'Elegir ubicación en el mapa'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.reminderSection}>
                  <Text style={[styles.reminderLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Fecha y hora del recordatorio</Text>

                  <View style={[styles.reminderButtonsRow, isCompact && styles.reminderButtonsRowCompact]}>
                    <Pressable
                      style={[
                        styles.reminderButton,
                        isPhone62 && styles.reminderButtonPhone62,
                        { backgroundColor: theme.primarySoft },
                        isCompact && styles.reminderButtonCompact,
                      ]}
                      onPress={() => openDatePicker('edit')}
                    >
                      <Text style={[styles.reminderButtonText, isPhone62 && styles.reminderButtonTextPhone62, { color: theme.primaryText }]}> 
                        {editReminderAt ? formatDate(editReminderAt) : 'Elegir fecha'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.reminderButton,
                        isPhone62 && styles.reminderButtonPhone62,
                        { backgroundColor: theme.primarySoft },
                        isCompact && styles.reminderButtonCompact,
                      ]}
                      onPress={() => openTimePicker('edit')}
                    >
                      <Text style={[styles.reminderButtonText, isPhone62 && styles.reminderButtonTextPhone62, { color: theme.primaryText }]}> 
                        {editReminderAt ? formatTime(editReminderAt) : 'Elegir hora'}
                      </Text>
                    </Pressable>
                  </View>

                  {editReminderAt ? (
                    <View style={[styles.reminderPreviewRow, isPhone62 && styles.reminderPreviewRowPhone62]}>
                      <Text style={[styles.reminderPreviewText, isPhone62 && styles.reminderPreviewTextPhone62, { color: theme.secondaryText }]}> 
                        Recordatorio: {formatDateTime(editReminderAt)}
                      </Text>
                      <Pressable onPress={() => setEditReminderAt(null)}>
                        <Text style={[styles.reminderClearText, { color: theme.dangerText }]}>Quitar</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={[styles.reminderHint, { color: theme.mutedText }]}> 
                      Si eliges fecha y hora, la app te enviará una notificación.
                    </Text>
                  )}
                </View>

                <View style={[styles.optionRow, { borderBottomColor: theme.border }]}> 
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>Tarea completada</Text>
                    <Text style={[styles.optionSubtitle, { color: theme.mutedText }]}>Activa esto si ya quieres dejarla como terminada.</Text>
                  </View>
                  <Switch
                    value={editCompleted}
                    onValueChange={setEditCompleted}
                    trackColor={{ false: theme.chip, true: theme.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </ScrollView>

              <View style={styles.editActionsRow}>
                <Pressable
                  style={[styles.editActionButton, { backgroundColor: theme.surfaceAlt }]}
                  onPress={closeEditModal}
                >
                  <Text style={[styles.editActionButtonText, { color: theme.text }]}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.editActionButton, { backgroundColor: theme.primary }]}
                  onPress={saveEditedTodo}
                >
                  <Text style={[styles.editActionButtonText, styles.mapActionButtonTextPrimary]}>Guardar cambios</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        <Animated.View style={[styles.filterContentWrap, filterContentAnimatedStyle]}>
          <FlatList
            data={filteredTodos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <View style={[styles.emptyState, { backgroundColor: theme.surface }]}> 
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {filter === 'overdue' ? 'No hay tareas vencidas' : 'Ya terminé todo'}
                </Text>
                <Text style={[styles.emptyText, { color: theme.mutedText }]}> 
                  {filter === 'overdue'
                    ? 'Las tareas con fecha y hora vencidas aparecerán aquí.'
                    : 'Agrega una nueva tarea para seguir organizando su día.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TodoItem item={item} theme={theme} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openEditTodo} isPhone62={isPhone62} />
            )}
          />
        </Animated.View>

        {showMapPicker ? (
          <View style={[styles.mapOverlay, { backgroundColor: theme.overlay }]}>
            <SafeAreaView style={[styles.mapScreen, { backgroundColor: theme.surface }]}> 
              <View style={[styles.mapScreenHeader, { backgroundColor: theme.surface }]}> 
                <Text style={[styles.modalTitle, isPhone62 && styles.modalTitlePhone62, { color: theme.text }]}>Elegir ubicación en el mapa</Text>
                <Text style={[styles.mapHelperText, isPhone62 && styles.mapHelperTextPhone62, { color: theme.mutedText }]}> 
                  Toca el mapa o arrastra el pin para seleccionar el lugar.
                </Text>
              </View>

              <View style={styles.mapScreenBody}>
                <View style={styles.mapSearchSection}>
                  <Text style={[styles.mapSearchLabel, isPhone62 && styles.sectionLabelPhone62, { color: theme.text }]}>Buscar ubicación</Text>

                  <View style={[styles.mapSearchRow, isCompact && styles.inputRowCompact]}>
                    <View
                      style={[
                        styles.mapSearchInputShell,
                        {
                          backgroundColor: theme.surfaceAlt,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <TextInput
                        value={mapSearchText}
                        onChangeText={setMapSearchText}
                        placeholder="Ejemplo: Obelisco, escuela o una dirección"
                        placeholderTextColor={theme.mutedText}
                        selectionColor={theme.primary}
                        cursorColor={theme.primary}
                        underlineColorAndroid="transparent"
                        autoCorrect={false}
                        autoCapitalize="words"
                        autoComplete="off"
                        importantForAutofill="no"
                        allowFontScaling={false}
                        textAlignVertical="center"
                        keyboardAppearance={isDarkMode ? 'dark' : 'light'}
                        style={[
                          styles.mapSearchInput,
                          isPhone62 && styles.mapSearchInputPhone62,
                          { color: theme.text },
                        ]}
                        returnKeyType="search"
                        onSubmitEditing={searchMapLocation}
                      />
                    </View>

                    <Pressable
                      style={[
                        styles.mapSearchButton,
                        isPhone62 && styles.mapSearchButtonPhone62,
                        { backgroundColor: theme.primary },
                        isCompact && styles.addButtonCompact,
                      ]}
                      onPress={searchMapLocation}
                      disabled={isSearchingMap}
                    >
                      <Text style={[styles.mapSearchButtonText, isPhone62 && styles.mapSearchButtonTextPhone62]}>
                        {isSearchingMap ? 'Buscando...' : 'Buscar'}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.mapSearchHint, isPhone62 && styles.mapSearchHintPhone62, { color: theme.mutedText }]}>
                    {mapSearchResultLabel
                      ? `Mostrando: ${mapSearchResultLabel}`
                      : 'Si el mapa no enseña todos los nombres, búscalos aquí por texto.'}
                  </Text>
                </View>

                <View style={styles.mapFullscreenContainer}>
                  {mapHtml ? (
                    <WebView
                      style={styles.mapView}
                      originWhitelist={['*']}
                      source={{ html: mapHtml }}
                      onMessage={handleMapMessage}
                      javaScriptEnabled
                      domStorageEnabled
                      setSupportMultipleWindows={false}
                      startInLoadingState
                    />
                  ) : (
                    <View style={[styles.mapLoadingState, { backgroundColor: theme.surfaceAlt }]}> 
                      <Text style={[styles.mapLoadingText, { color: theme.mutedText }]}>Cargando mapa...</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.mapPinText, isPhone62 && styles.mapPinTextPhone62, { color: theme.secondaryText }]}> 
                  {draftLocationCoords
                    ? `Lat ${draftLocationCoords.latitude.toFixed(5)} · Lon ${draftLocationCoords.longitude.toFixed(5)}`
                    : 'Selecciona un punto en el mapa'}
                </Text>

                <View style={[styles.mapActionsRow, isPhone62 && styles.mapActionsRowPhone62]}>
                  <Pressable
                    style={[styles.mapActionButton, isPhone62 && styles.mapActionButtonPhone62, { backgroundColor: theme.surfaceAlt }]}
                    onPress={closeMapPicker}
                  >
                    <Text style={[styles.mapActionButtonText, isPhone62 && styles.mapActionButtonTextPhone62, { color: theme.text }]}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.mapActionButton, isPhone62 && styles.mapActionButtonPhone62, { backgroundColor: theme.primary }]}
                    onPress={saveMapLocation}
                  >
                    <Text style={[styles.mapActionButtonText, isPhone62 && styles.mapActionButtonTextPhone62, styles.mapActionButtonTextPrimary]}>Guardar</Text>
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <TodoApp />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorSafeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  errorContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    marginTop: 20,
    backgroundColor: '#818cf8',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  containerAndroid: {
    paddingTop: 28,
  },
  containerPhone62: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  containerCompact: {
    paddingTop: 8,
  },
  header: {
    marginBottom: 18,
  },
  headerPhone62: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 40,
    fontWeight: '800',
    color: '#0f172a',
  },
  titlePhone62: {
    fontSize: 30,
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 34,
  },
  titleVeryCompact: {
    fontSize: 30,
  },
  titleAddButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  settingsButtonText: {
    fontSize: 22,
  },
  titleAddButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalOverlayPhone62: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalCardPhone62: {
    borderRadius: 20,
    padding: 16,
  },
  editModalCard: {
    maxHeight: '88%',
  },
  editModalCardPhone62: {
    maxHeight: '92%',
  },
  editScrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  mapModalCard: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    maxHeight: '84%',
  },
  mapModalCardPhone62: {
    borderRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  mapScreen: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    elevation: 40,
  },
  mapScreenHeader: {
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 10,
  },
  mapScreenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mapSearchSection: {
    gap: 8,
    marginBottom: 12,
    zIndex: 5,
    elevation: 5,
  },
  mapSearchLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  mapSearchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  mapSearchInputShell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
  },
  mapSearchInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
    minHeight: 50,
  },
  mapSearchInputPhone62: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  mapSearchButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchButtonPhone62: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  mapSearchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  mapSearchButtonTextPhone62: {
    fontSize: 13,
  },
  mapSearchHint: {
    fontSize: 13,
  },
  mapSearchHintPhone62: {
    fontSize: 12,
  },
  mapFullscreenContainer: {
    flex: 1,
    minHeight: 320,
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 1,
    elevation: 1,
  },
  mapLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 18,
  },
  modalTitlePhone62: {
    fontSize: 21,
    marginBottom: 14,
  },
  mapHelperText: {
    fontSize: 14,
    marginBottom: 12,
  },
  mapHelperTextPhone62: {
    fontSize: 13,
    marginBottom: 10,
  },
  mapContainer: {
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
  },
  mapContainerPhone62: {
    height: 260,
    borderRadius: 16,
  },
  mapView: {
    flex: 1,
  },
  mapPinText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  mapPinTextPhone62: {
    marginTop: 10,
    fontSize: 12,
  },
  mapActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  mapActionsRowPhone62: {
    marginTop: 12,
  },
  mapActionButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  mapActionButtonPhone62: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mapActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  mapActionButtonTextPhone62: {
    fontSize: 14,
  },
  mapActionButtonTextPrimary: {
    color: '#ffffff',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSubtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalCloseButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  editActionButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  editActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inputCardPhone62: {
    borderRadius: 18,
    padding: 10,
    gap: 12,
  },
  composerBelowActions: {
    marginTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  inputRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  inputPhone62: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  addButtonPhone62: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addButtonCompact: {
    width: '100%',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  addButtonTextPhone62: {
    fontSize: 14,
  },
  reminderSection: {
    gap: 10,
  },
  descriptionSection: {
    gap: 8,
  },
  descriptionInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 92,
  },
  descriptionInputPhone62: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 84,
  },
  locationSection: {
    gap: 8,
  },
  locationLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionLabelPhone62: {
    fontSize: 14,
  },
  locationInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  locationInputPhone62: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  currentLocationButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  currentLocationButtonPhone62: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  currentLocationButtonDisabled: {
    opacity: 0.7,
  },
  currentLocationButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentLocationButtonTextPhone62: {
    fontSize: 13,
  },
  locationHint: {
    fontSize: 13,
  },
  locationHintPhone62: {
    fontSize: 12,
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  reminderButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reminderButtonsRowCompact: {
    flexDirection: 'column',
  },
  reminderButton: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reminderButtonPhone62: {
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  reminderButtonCompact: {
    width: '100%',
  },
  reminderButtonText: {
    color: '#3730a3',
    fontWeight: '700',
    textAlign: 'center',
  },
  reminderButtonTextPhone62: {
    fontSize: 13,
  },
  reminderPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  reminderPreviewRowPhone62: {
    gap: 8,
  },
  reminderPreviewText: {
    flex: 1,
    color: '#475569',
    fontSize: 14,
  },
  reminderPreviewTextPhone62: {
    fontSize: 13,
  },
  reminderClearText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  reminderHint: {
    color: '#64748b',
    fontSize: 13,
  },
  summaryRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  summaryTextPhone62: {
    fontSize: 14,
  },
  clearText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  filterSection: {
    marginTop: 18,
    marginBottom: 10,
    gap: 12,
  },
  filterSectionCompact: {
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    marginBottom: 10,
    alignItems: 'center',
  },
  filterRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterGroupCompact: {
    width: '100%',
  },
  filterGroupPhone62: {
    width: '100%',
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  filterActionsCompact: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  filterActionsStandalone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  filterActionsStandaloneCompact: {
    width: '100%',
  },
  filterContentWrap: {
    flex: 1,
  },
  filterActionButton: {
    width: 46,
    height: 46,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
  },
  filterButtonPhone62: {
    minHeight: 46,
    width: '100%',
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonCompact: {
    paddingHorizontal: 12,
  },
  filterButtonActive: {
    backgroundColor: '#0f172a',
  },
  filterButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterButtonTextPhone62: {
    fontSize: 15,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  todoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todoCardPhone62: {
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCirclePhone62: {
    width: 26,
    height: 26,
  },
  checkCircleDone: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkMark: {
    color: '#ffffff',
    fontWeight: '800',
  },
  todoContent: {
    flex: 1,
  },
  todoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todoTitle: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  todoTitlePhone62: {
    fontSize: 15,
  },
  todoTitleDone: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
  },
  todoMetaPhone62: {
    fontSize: 12,
  },
  todoExpandHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  todoExpandHintPhone62: {
    fontSize: 11,
  },
  todoDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  todoDescriptionPhone62: {
    fontSize: 13,
    lineHeight: 18,
  },
  todoLocation: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  todoLocationPhone62: {
    fontSize: 12,
  },
  todoCoords: {
    marginTop: 4,
    fontSize: 12,
  },
  todoCoordsPhone62: {
    fontSize: 11,
  },
  todoReminder: {
    marginTop: 4,
    color: '#4338ca',
    fontSize: 13,
    fontWeight: '600',
  },
  todoReminderPhone62: {
    fontSize: 12,
  },
  editButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editButtonPhone62: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editButtonText: {
    color: '#3730a3',
    fontWeight: '700',
  },
  editButtonTextPhone62: {
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteButtonPhone62: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  deleteButtonTextPhone62: {
    fontSize: 13,
  },
});
