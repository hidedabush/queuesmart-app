import React, { useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useServices } from '../../../data/ServicesStore';
import Field from '../../../components/Field';
import Button from '../../../components/Button';
import { PriorityMeter } from '../../../components/Pill';
import { colors, fonts, priorityLevels, radius, spacing, type } from '../../../theme';

const MAX_NAME = 100;
const MAX_DURATION = 480; // eight hours; anything longer is a data-entry mistake
const PRIORITIES = ['low', 'medium', 'high'];
const DURATION_PRESETS = [5, 10, 15, 30, 45, 60];

/**
 * Service Management — create and edit (A2 requirements 3.2 and 5)
 *
 * One screen handles both cases. The route parameter is either 'new' or an
 * existing service id, which keeps the field list and the validation rules in
 * a single place instead of duplicated across two screens.
 *
 * Validation runs on submit, and re-runs on every keystroke afterwards, so a
 * person is not corrected while they are still typing the first time.
 */
export default function ServiceForm() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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

  // An edit route for a service that does not exist, e.g. after deleting it.
  if (!isNew && !existing) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Service' }} />
        <Text style={[type.label, { color: colors.accentText }]}>404 · Not found</Text>
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

    if (Object.keys(found).length > 0) return;

    const draft = {
      name: name.trim(),
      description: description.trim(),
      expectedDuration: Number(duration),
      priority,
    };

    if (isNew) {
      createService(draft);
    } else {
      updateService(id, draft);
    }
    router.back();
  }

  function confirmDelete() {
    deleteService(id);
    router.replace('/admin/services');
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
    >
      <Stack.Screen options={{ title: isNew ? 'New service' : 'Edit service' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={type.label}>
            {isNew ? 'Create' : `Editing · ${existing.id.toUpperCase()}`}
          </Text>
          <Text style={[type.display, { marginTop: spacing.xs }]}>
            {isNew ? 'New service' : existing.name}
          </Text>
        </View>

        {submitted && errorCount > 0 ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorBannerText}>
              {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention
            </Text>
          </View>
        ) : null}

        <Field
          index="01"
          label="Service name"
          required
          value={name}
          onChangeText={(text) => {
            setName(text);
            revalidate({ name: text });
          }}
          error={errors.name}
          maxLength={MAX_NAME}
          showCounter
          placeholder="Academic Advising"
        />

        <Field
          index="02"
          label="Description"
          required
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            revalidate({ description: text });
          }}
          error={errors.description}
          multiline
          helper="Shown to people choosing a service, so describe it in their words."
          placeholder="Degree planning, course selection, and registration holds."
        />

        <Field
          index="03"
          label="Expected duration"
          required
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
          placeholder="15"
        >
          <View style={styles.presets}>
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
                  accessibilityLabel={`Set duration to ${mins} minutes`}
                  accessibilityState={{ selected }}
                  style={[styles.preset, selected && styles.presetSelected]}
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
          <Text style={[type.label, { marginBottom: spacing.sm }]}>
            <Text style={{ color: colors.accentText }}>04 </Text>
            Priority level<Text style={{ color: colors.accentText }}> *</Text>
          </Text>
          <View style={styles.tiles} accessibilityRole="radiogroup">
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
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${priorityLevels[level].label} priority`}
                  style={({ pressed }) => [
                    styles.tile,
                    selected && styles.tileSelected,
                    pressed && !selected && { backgroundColor: colors.raised },
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

        <Preview
          name={name}
          duration={duration}
          priority={priority}
        />

        <Button
          label={isNew ? 'Create service' : 'Save changes'}
          onPress={handleSave}
          style={{ marginTop: spacing.xl }}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          style={{ marginTop: spacing.md }}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Shows how the service will read on the Admin Dashboard as it's typed.
function Preview({ name, duration, priority }) {
  return (
    <View style={styles.preview} accessibilityLabel="Dashboard preview">
      <Text style={type.label}>Preview · dashboard row</Text>
      <View style={styles.previewRow}>
        <Text style={styles.previewIndex}>00</Text>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontWeight: '700' }]} numberOfLines={1}>
            {name.trim() || 'Service name'}
          </Text>
          <Text style={[type.label, { textTransform: 'none', letterSpacing: 0.5, marginTop: 2 }]}>
            {duration && /^\d+$/.test(duration) ? `${Number(duration)} min per person` : '— min per person'}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <PriorityMeter priority={priority} />
          </View>
        </View>
        <Text style={styles.previewCount}>00</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  intro: {
    paddingBottom: spacing.lg,
    marginBottom: spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },

  errorBanner: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
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

  presets: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  preset: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetSelected: { backgroundColor: colors.text, borderColor: colors.text },
  presetText: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '700', color: colors.muted },

  priorityBlock: { marginBottom: spacing.xl },
  tiles: { flexDirection: 'row' },
  tile: {
    flex: 1,
    minHeight: 80,
    padding: spacing.md,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  tileSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  tileLabel: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: spacing.md,
  },
  inlineError: { marginTop: spacing.sm, fontSize: 14, fontWeight: '600', color: colors.accentText },

  preview: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    padding: spacing.md,
  },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md },
  previewIndex: { width: 36, fontFamily: fonts.mono, fontWeight: '700', color: colors.faint, paddingTop: 2 },
  previewCount: { fontFamily: fonts.mono, fontSize: 26, fontWeight: '700', color: colors.faint },

  dangerZone: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },

  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: 'center',
  },
});
