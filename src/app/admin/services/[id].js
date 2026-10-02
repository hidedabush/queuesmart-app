import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServices } from '../../../data/ServicesStore';
import Field from '../../../components/Field';
import Button from '../../../components/Button';
import QueueRow from '../../../components/QueueRow';
import { PriorityMeter } from '../../../components/Pill';
import { useToast } from '../../../components/Toast';
import { contentWidth, useLayout } from '../../../hooks/useLayout';
import { colors, fonts, layout, priorityLevels, radius, spacing, touch, type } from '../../../theme';

const MAX_NAME = 100;
const MAX_DURATION = 480; // eight hours; anything longer is a data-entry mistake
const PRIORITIES = ['low', 'medium', 'high'];
const DURATION_PRESETS = [5, 10, 15, 30, 45, 60];
const FIELD_ORDER = ['name', 'description', 'duration'];
const MAIN_COLUMN = 640;
const SIDE_COLUMN = 360;

/**
 * Service Management — create and edit (A2 requirements 3.2 and 5)
 *
 * One screen handles both cases. The route parameter is either 'new' or an
 * existing service id, which keeps the field list and the validation rules in
 * a single place instead of duplicated across two screens.
 *
 * Validation runs on submit, and re-runs on every keystroke afterwards, so a
 * person is not corrected while they are still typing the first time. A failed
 * save moves focus to the first field that needs attention.
 */
export default function ServiceForm() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { isWide, isCompact, gutter } = useLayout();
  const { getService, createService, updateService, deleteService } = useServices();

  const isNew = id === 'new';
  const existing = isNew ? null : getService(id);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [duration, setDuration] = useState(
    existing ? String(existing.expectedDuration) : ''
  );
  const [priority, setPriority] = useState(existing?.priority ?? 'medium');

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const refs = { name: useRef(null), description: useRef(null), duration: useRef(null) };
  // Set once this screen deletes its own service, so the closing screen keeps
  // showing the form instead of flashing the "not found" state.
  const deleted = useRef(false);

  const width = isWide ? MAIN_COLUMN + spacing.xxl + SIDE_COLUMN : layout.readable;

  // Works whether the form was pushed from the list or opened from a link.
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/admin/services');
  }

  // An edit route for a service that does not exist, e.g. after deleting it.
  if (!isNew && !existing && !deleted.current) {
    return (
      <View style={[styles.screen, styles.missing, contentWidth(layout.readable, gutter)]}>
        <Text style={[type.label, { color: colors.accentText }]}>Not found</Text>
        <Text style={[type.title, { marginTop: spacing.sm }]}>
          This service is no longer available
        </Text>
        <Text style={[type.secondary, { marginTop: spacing.xs }]}>
          It may have been deleted. Go back to see the current list.
        </Text>
        <Button
          label="Back to services"
          onPress={() => router.replace('/admin/services')}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    );
  }

  function validate(values) {
    const next = {};

    const trimmedName = values.name.trim();
    if (!trimmedName) {
      next.name = 'Enter a service name.';
    } else if (trimmedName.length > MAX_NAME) {
      next.name = `Keep the name to ${MAX_NAME} characters or fewer.`;
    }

    if (!values.description.trim()) {
      next.description = 'Describe what this service is for.';
    }

    if (!values.duration.trim()) {
      next.duration = 'Enter how long one appointment usually takes.';
    } else if (!/^\d+$/.test(values.duration.trim())) {
      next.duration = 'Use whole minutes, digits only.';
    } else {
      const minutes = Number(values.duration);
      if (minutes < 1) {
        next.duration = 'Expected duration must be at least 1 minute.';
      } else if (minutes > MAX_DURATION) {
        next.duration = `Expected duration must be ${MAX_DURATION} minutes or less.`;
      }
    }

    if (!PRIORITIES.includes(values.priority)) {
      next.priority = 'Choose a priority level.';
    }

    return next;
  }

  // Once the person has tried to save, keep the errors current as they type.
  function revalidate(patch) {
    if (!submitted) return;
    setErrors(validate({ name, description, duration, priority, ...patch }));
  }

  function handleSave() {
    const values = { name, description, duration, priority };
    const found = validate(values);
    setSubmitted(true);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      const first = FIELD_ORDER.find((key) => found[key]);
      if (first) refs[first].current?.focus();
      return;
    }

    const draft = {
      name: name.trim(),
      description: description.trim(),
      expectedDuration: Number(duration),
      priority,
    };

    if (isNew) {
      createService(draft);
      toast(`${draft.name} created`);
    } else {
      updateService(id, draft);
      toast('Changes saved');
    }
    leave();
  }

  function confirmDelete() {
    deleted.current = true;
    const deletedName = existing.name;
    leave();
    deleteService(id);
    toast(`${deletedName} deleted`);
  }

  function handleDelete() {
    const title = `Delete ${existing.name}?`;
    const message = 'People currently in this queue will be removed. This cannot be undone.';

    // Alert.alert with buttons is a no-op on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) confirmDelete();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Keep service', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={[contentWidth(width, gutter), styles.content]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isWide && styles.columns}>
          <View style={isWide && styles.mainColumn}>
            {submitted && errorCount > 0 ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite" accessibilityRole="alert">
                <Text style={styles.errorBannerText}>
                  {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention
                </Text>
              </View>
            ) : (
              <Text style={[type.secondary, styles.note]}>All fields are required.</Text>
            )}

            <Field
              inputRef={refs.name}
              label="Service name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                revalidate({ name: text });
              }}
              error={errors.name}
              maxLength={MAX_NAME}
              showCounter
              placeholder="e.g. Academic Advising"
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => refs.description.current?.focus()}
            />

            <Field
              inputRef={refs.description}
              label="Description"
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                revalidate({ description: text });
              }}
              error={errors.description}
              multiline
              helper="Shown to people choosing a service, so describe it in their words."
              placeholder="e.g. Degree planning, course selection, and registration holds."
            />

            <Field
              inputRef={refs.duration}
              label="Expected duration"
              value={duration}
              onChangeText={(text) => {
                setDuration(text);
                revalidate({ duration: text });
              }}
              error={errors.duration}
              keyboardType="number-pad"
              maxLength={3}
              suffix="min"
              helper="Minutes per person. Used to estimate wait times."
              placeholder="e.g. 15"
            >
              <View style={styles.presets} accessibilityLabel="Common durations">
                {DURATION_PRESETS.map((mins) => {
                  const selected = duration === String(mins);
                  return (
                    <Pressable
                      key={mins}
                      onPress={() => {
                        setDuration(String(mins));
                        revalidate({ duration: String(mins) });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${mins} minutes`}
                      aria-selected={selected}
                      style={({ pressed, hovered }) => [
                        styles.preset,
                        // One even row of six; an even 3x2 grid when six won't fit.
                        isCompact ? styles.presetThird : styles.presetSixth,
                        hovered && !selected && { backgroundColor: colors.hover },
                        pressed && !selected && { backgroundColor: colors.raised },
                        selected && styles.presetSelected,
                      ]}
                    >
                      <Text style={[styles.presetText, selected && { color: colors.bg }]}>
                        {mins}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <View style={styles.priorityBlock}>
              <Text style={[type.fieldLabel, { marginBottom: spacing.sm }]}>Priority level</Text>
              <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel="Priority level">
                {PRIORITIES.map((level) => {
                  const selected = priority === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => {
                        setPriority(level);
                        revalidate({ priority: level });
                      }}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityLabel={`${priorityLevels[level].label} priority`}
                      accessibilityHint={priorityLevels[level].hint}
                      style={({ pressed, hovered }) => [
                        styles.tile,
                        hovered && !selected && { backgroundColor: colors.hover },
                        pressed && !selected && { backgroundColor: colors.raised },
                        selected && styles.tileSelected,
                      ]}
                    >
                      <PriorityMeter priority={level} showLabel={false} />
                      <Text style={[styles.tileLabel, selected && { color: colors.text }]}>
                        {priorityLevels[level].label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[type.secondary, { marginTop: spacing.sm }]}>
                {priorityLevels[priority]?.hint}
              </Text>
              {errors.priority ? (
                <Text style={styles.inlineError}>✕ {errors.priority}</Text>
              ) : null}
            </View>
          </View>

          <View style={isWide && styles.sideColumn}>
            <Preview
              name={name}
              description={description}
              duration={duration}
              priority={priority}
              live={existing}
            />

            {!isNew ? (
              <View style={styles.dangerZone}>
                <Text style={[type.label, { color: colors.accentText }]}>Danger zone</Text>
                <Text style={[type.secondary, { marginVertical: spacing.sm }]}>
                  Deleting removes the service and everyone waiting in its queue.
                </Text>
                <Button label="Delete service" variant="danger" onPress={handleDelete} />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: spacing.md + insets.bottom }]}>
        <View style={[contentWidth(width, gutter), styles.actionRow, isWide && styles.actionRowWide]}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={leave}
            style={isWide ? styles.cancelWide : styles.cancel}
          />
          <Button
            label={isNew ? 'Create service' : 'Save changes'}
            onPress={handleSave}
            style={isWide ? styles.saveWide : styles.save}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Renders the real dashboard row, so what you see here is exactly what
// administrators will see on the board. When editing, it uses the live queue,
// so a duration change shows its effect on the wait estimate immediately.
function Preview({ name, description, duration, priority, live }) {
  const minutes = /^\d+$/.test(duration) && Number(duration) > 0 ? Number(duration) : 0;
  const service = {
    name: name.trim() || 'Service name',
    description,
    expectedDuration: minutes,
    priority,
    isOpen: live ? live.isOpen : true,
    waiting: live ? live.waiting : 0,
  };

  return (
    // Visual only: it repeats what the fields above already announce.
    <View style={styles.preview} aria-hidden>
      <Text style={type.label}>Preview · dashboard row</Text>
      <QueueRow service={service} preview />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  columns: { flexDirection: 'row', alignItems: 'flex-start', columnGap: spacing.xxl },
  mainColumn: { flex: 1, maxWidth: MAIN_COLUMN },
  sideColumn: { width: SIDE_COLUMN },

  note: { marginBottom: spacing.lg },

  errorBanner: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.sm,
  },
  errorBannerText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, maxWidth: 480 },
  presetSixth: { flexGrow: 1, flexBasis: 0 },
  presetThird: { flexGrow: 1, flexBasis: '30%' },
  preset: {
    minHeight: touch - 4,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.control,
    borderRadius: radius.sm,
  },
  presetSelected: { backgroundColor: colors.text, borderColor: colors.text },
  presetText: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '700', color: colors.muted },

  priorityBlock: { marginBottom: spacing.xl },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 68,
    padding: spacing.md,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.control,
    borderRadius: radius.sm,
  },
  tileSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    padding: spacing.md - 1,
    backgroundColor: colors.accentSoft,
  },
  tileLabel: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: spacing.sm,
  },
  inlineError: { marginTop: spacing.sm, fontSize: 14, fontWeight: '600', color: colors.accentText },

  preview: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },

  dangerZone: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },

  actionBar: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  actionRow: { flexDirection: 'row', columnGap: spacing.sm },
  actionRowWide: { justifyContent: 'flex-end' },
  cancel: { flex: 1 },
  save: { flex: 2 },
  cancelWide: { width: 160 },
  saveWide: { width: 240 },

  missing: { justifyContent: 'center' },
});
