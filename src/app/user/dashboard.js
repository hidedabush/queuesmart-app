import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatWait } from '../../api/services';
import Button from '../../frontend/components/Button';
import { OpenPill } from '../../frontend/components/Pill';
import { useQueue, useServices } from '../../frontend/state/ServicesStore';
import { colors, radius, spacing, type } from '../../frontend/theme';

function getQueueStatus(status) {
  switch (status) {
    case 'almost-ready':
      return {
        label: 'Almost ready',
        message: 'You are almost up. Please be ready.',
      };
    case 'served':
      return {
        label: 'Visit complete',
        message: 'Your queue visit has been completed.',
      };
    default:
      return {
        label: 'Waiting',
        message: 'You are currently waiting in line.',
      };
  }
}

function BellIcon() {
  return (
    <View style={styles.bellIcon}>
      <View style={styles.bellTop} />
      <View style={styles.bellBody} />
      <View style={styles.bellRim} />
      <View style={styles.bellClapper} />
    </View>
  );
}

function NotificationBellButton({ count, onPress, accessibilityLabel }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <BellIcon />
      {count > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ProfileIcon() {
  return (
    <View style={styles.profileIcon}>
      <View style={styles.profileHead} />
      <View style={styles.profileShoulders} />
    </View>
  );
}

function HistoryIcon() {
  return (
    <View style={styles.historyIcon}>
      <View style={styles.clockHandVertical} />
      <View style={styles.clockHandHorizontal} />
    </View>
  );
}

function NotificationItem({ item, onDismiss }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-12, 12])
      .runOnJS(true)
      .onUpdate((event) => {
        translateX.setValue(Math.min(0, event.translationX));
      })
      .onEnd((event) => {
        if (event.translationX < -64 || (event.translationX < -18 && event.velocityX < -450)) {
          Animated.timing(translateX, {
            toValue: -800,
            duration: 160,
            useNativeDriver: true,
          }).start(() => onDismiss(item.id));
          return;
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }),
    [item.id, onDismiss, translateX]
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.notificationRow, { transform: [{ translateX }] }]}>
        <View style={[styles.notificationDot, item.urgent && styles.notificationDotUrgent]} />
        <View style={styles.notificationBody}>
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
          <Text style={styles.notificationMessage}>{item.message}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function UserDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services } = useServices();
  const { activeQueue } = useQueue();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);
  const sheetTranslateY = useMemo(() => new Animated.Value(0), []);
  const sheetPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        sheetTranslateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 60 || (gesture.dy > 12 && gesture.vy > 0.45)) {
          setNotificationsVisible(false);
          sheetTranslateY.setValue(0);
          return;
        }

        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
    [sheetTranslateY]
  );

  const service = activeQueue
    ? services.find((item) => item.id === activeQueue.serviceId)
    : null;
  const openServices = services.filter((item) => item.isOpen);
  const queueStatus = activeQueue ? getQueueStatus(activeQueue.status) : null;

  const notifications = useMemo(() => {
    const items = [];

    if (activeQueue && service) {
      const message = getQueueStatus(activeQueue.status).message;
      items.push({
        id: 'queue-status',
        title: `${service.name}: ${getQueueStatus(activeQueue.status).label}`,
        message,
        time: 'Just now',
        urgent: activeQueue.status === 'almost-ready',
      });
    }

    openServices.slice(0, activeQueue ? 1 : 2).forEach((item) => {
      items.push({
        id: `open-${item.id}`,
        title: `${item.name} is open`,
        message: `${item.waiting} waiting · about ${formatWait(item)}.`,
        time: 'Service update',
        urgent: false,
      });
    });

    return items.filter((item) => !dismissedNotifications.includes(item.id));
  }, [activeQueue, dismissedNotifications, openServices, service]);

  const dismissNotification = (id) => {
    setDismissedNotifications((current) => [...current, id]);
  };

  const dismissAllNotifications = () => {
    setDismissedNotifications((current) => [
      ...new Set([...current, ...notifications.map((item) => item.id)]),
    ]);
  };

  return (
    <GestureHandlerRootView style={styles.screen}>
      <Stack.Screen options={{ title: 'Dashboard', headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
            onPress={() => router.push('/user/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <ProfileIcon />
          </Pressable>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>QueueSmart</Text>
            <Text style={styles.kicker}>USER DASHBOARD</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
              onPress={() => router.push('/user/history')}
              accessibilityRole="button"
              accessibilityLabel="View queue history"
            >
              <HistoryIcon />
            </Pressable>
            <NotificationBellButton
              count={notifications.length}
              onPress={() => setNotificationsVisible(true)}
              accessibilityLabel={`Recent notifications, ${notifications.length} updates`}
            />
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>Your day, in order.</Text>
          <Text style={styles.welcomeCopy}>Check your place or find a service.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={type.label}>Your queue</Text>
          <View style={styles.liveLabel}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {activeQueue && service ? (
          <View style={styles.queuePanel}>
            <View style={styles.queuePanelTop}>
              <View style={styles.queueServiceName}>
                <Text style={styles.queueService} numberOfLines={1}>{service.name}</Text>
                <Text style={styles.queueStatus}>{queueStatus.label}</Text>
              </View>
              <View style={styles.positionBlock}>
                <Text style={styles.positionValue}>#{activeQueue.position}</Text>
                <Text style={styles.positionLabel}>YOUR PLACE</Text>
              </View>
            </View>
            <View style={styles.queueDivider} />
            <View style={styles.queuePanelBottom}>
              <Text style={styles.queueMessage}>{queueStatus.message}</Text>
              <View style={styles.waitBlock}>
                <Text style={styles.waitValue}>
                  {activeQueue.estimatedWait.low}-{activeQueue.estimatedWait.high} min
                </Text>
                <Text style={styles.positionLabel}>EST. WAIT</Text>
              </View>
            </View>
            <Button
              label="View queue status"
              onPress={() => router.push('/user/queue-status')}
              style={styles.queueButton}
            />
          </View>
        ) : (
          <View style={styles.emptyQueuePanel}>
            <View style={styles.emptyQueueCopy}>
              <Text style={styles.emptyQueueTitle}>Nothing in line yet</Text>
              <Text style={styles.emptyQueueDescription}>
                Join an open service and keep your place updated here.
              </Text>
            </View>
            <Button
              label="Join a queue"
              onPress={() => router.push('/user/join-queue')}
              style={styles.queueButton}
            />
          </View>
        )}

        <View style={styles.servicesSection}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={type.label}>Available services</Text>
              <Text style={styles.sectionSubtitle}>
                {openServices.length} {openServices.length === 1 ? 'service' : 'services'} open
              </Text>
            </View>
            <Text style={styles.scrollHint}>SWIPE  &gt;</Text>
          </View>

          {openServices.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.serviceRail}
            >
              {openServices.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.serviceTile, pressed && styles.pressed]}
                  onPress={() => router.push({
                    pathname: '/user/join-queue',
                    params: { selectedServiceId: item.id },
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name} in available services`}
                >
                  <View style={styles.serviceTileTop}>
                    <Text style={styles.serviceIndex}>0{index + 1}</Text>
                    <OpenPill isOpen={item.isOpen} />
                  </View>
                  <Text style={styles.serviceName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.serviceMetrics}>
                    <View>
                      <Text style={styles.metricValue}>{item.waiting}</Text>
                      <Text style={styles.metricLabel}>WAITING</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View>
                      <Text style={styles.metricValue}>{formatWait(item)}</Text>
                      <Text style={styles.metricLabel}>EST. WAIT</Text>
                    </View>
                  </View>
                  <Text style={styles.serviceAction}>VIEW SERVICE  &gt;</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noServices}>
              <Text style={styles.noServicesText}>All service queues are closed right now.</Text>
            </View>
          )}

          <Button
            label="Browse all services"
            variant="secondary"
            onPress={() => router.push('/user/join-queue')}
            style={styles.browseButton}
          />
        </View>

      </ScrollView>

      <Modal
        visible={notificationsVisible}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <GestureHandlerRootView style={styles.modalRoot} accessibilityViewIsModal>
          <View style={styles.modalBackdrop} />
          <Animated.View
            style={[styles.notificationSheet, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            <View
              style={styles.sheetDragArea}
              {...sheetPanResponder.panHandlers}
              accessibilityRole="button"
              accessibilityLabel="Drag down to close notifications"
            >
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetHeading}>
              <View style={styles.sheetHeadingText}>
                <Text style={styles.sheetTitle}>Recent updates</Text>
                <Text style={styles.sheetSubtitle}>Queue and service activity</Text>
              </View>
              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.clearAllButton,
                    pressed && notifications.length > 0 && styles.pressed,
                    notifications.length === 0 && styles.clearAllButtonDisabled,
                  ]}
                  onPress={dismissAllNotifications}
                  disabled={notifications.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all notifications"
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setNotificationsVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications"
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>
            </View>
            {notifications.length ? notifications.map((item) => (
              <NotificationItem key={item.id} item={item} onDismiss={dismissNotification} />
            )) : (
              <Text style={styles.notificationEmpty}>You are all caught up.</Text>
            )}
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileButton: {
    width: 44,
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  profileIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  profileHead: {
    position: 'absolute',
    top: 1,
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 5,
  },
  profileShoulders: {
    width: 22,
    height: 12,
    borderWidth: 2,
    borderColor: colors.text,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 0,
  },
  brandBlock: {
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconButton: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 11,
  },
  clockHandVertical: {
    position: 'absolute',
    top: 4,
    left: 9,
    width: 2,
    height: 7,
    backgroundColor: colors.text,
  },
  clockHandHorizontal: {
    position: 'absolute',
    top: 9,
    left: 10,
    width: 5,
    height: 2,
    backgroundColor: colors.text,
  },
  brand: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  kicker: {
    ...type.label,
    fontSize: 10,
    marginTop: 3,
  },
  bellButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
  },
  bellTop: {
    position: 'absolute',
    top: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  bellBody: {
    position: 'absolute',
    top: 4,
    width: 18,
    height: 15,
    borderWidth: 2,
    borderColor: colors.text,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  bellRim: {
    position: 'absolute',
    bottom: 4,
    width: 22,
    height: 4,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 2,
  },
  bellClapper: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  welcome: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
  },
  welcomeCopy: {
    ...type.secondary,
    marginTop: spacing.xs,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentText,
  },
  liveText: {
    ...type.label,
    color: colors.accentText,
    fontSize: 10,
  },
  queuePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentSoftStrong,
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  queuePanelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  queueServiceName: {
    flex: 1,
    paddingTop: 2,
  },
  queueService: {
    ...type.heading,
    fontSize: 18,
  },
  queueStatus: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  positionBlock: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  positionValue: {
    ...type.metric,
    fontSize: 28,
    lineHeight: 32,
  },
  positionLabel: {
    ...type.label,
    fontSize: 9,
    marginTop: 2,
  },
  queueDivider: {
    height: 1,
    backgroundColor: colors.accentSoftStrong,
    marginVertical: spacing.md,
  },
  queuePanelBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  queueMessage: {
    ...type.secondary,
    flex: 1,
  },
  waitBlock: {
    alignItems: 'flex-end',
  },
  waitValue: {
    ...type.metric,
    fontSize: 16,
  },
  queueButton: {
    marginTop: spacing.lg,
  },
  emptyQueuePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyQueueCopy: {
    marginBottom: spacing.lg,
  },
  emptyQueueTitle: {
    ...type.heading,
    fontSize: 18,
  },
  emptyQueueDescription: {
    ...type.secondary,
    marginTop: spacing.xs,
  },
  servicesSection: {
    marginTop: spacing.xxl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    ...type.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  scrollHint: {
    ...type.label,
    fontSize: 9,
    color: colors.faint,
  },
  serviceRail: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  serviceTile: {
    width: 248,
    minHeight: 234,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  serviceTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceIndex: {
    ...type.label,
    color: colors.accentText,
  },
  serviceName: {
    ...type.heading,
    fontSize: 18,
    lineHeight: 23,
    marginTop: spacing.lg,
    minHeight: 46,
  },
  serviceDescription: {
    ...type.secondary,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
    marginTop: spacing.xs,
  },
  serviceMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  metricValue: {
    ...type.metric,
    fontSize: 14,
  },
  metricLabel: {
    ...type.label,
    fontSize: 8,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.lineStrong,
  },
  serviceAction: {
    color: colors.accentText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  noServices: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  noServicesText: {
    ...type.secondary,
  },
  browseButton: {
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.78,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(156, 156, 156, 0.42)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  notificationSheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    borderTopWidth: 2,
    borderTopColor: colors.accent,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.surface,
    elevation: 24,
    boxShadow: '0px -10px 18px rgba(0, 0, 0, 0.55)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  sheetDragArea: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  sheetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  sheetHeadingText: {
    flex: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetTitle: {
    ...type.title,
    fontSize: 21,
  },
  sheetSubtitle: {
    ...type.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  closeButtonText: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
  },
  clearAllButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  clearAllButtonDisabled: {
    opacity: 0.4,
  },
  clearAllText: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: '700',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
    marginTop: 5,
  },
  notificationDotUrgent: {
    backgroundColor: colors.accentText,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '700',
  },
  notificationTime: {
    ...type.label,
    fontSize: 9,
    textAlign: 'right',
  },
  notificationMessage: {
    ...type.secondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  notificationEmpty: {
    ...type.secondary,
    paddingTop: spacing.xl,
  },
});