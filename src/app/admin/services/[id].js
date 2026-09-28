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
import { colors, radius, spacing, type, priorityTone } from '../../../theme';

const MAX_NAME = 100;
const MAX_DURATION = 480; // eight hours; anything longer is a data-entry mistake
const PRIORITIES = ['low', 'medium', 'high'];

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
        <Text style={type.heading}>This service is no longer available</Text>
        <Text style={styles.missingBody}>
          It may have been deleted. Go back to see the current list.
        </Text>
        <Button
          label="Back to services"
          onPress={() => router.replace('/admin/services')}
          style={{ marginTop: spacing.lg }}
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

  function handleDelete() {
    Alert.alert(
      `Delete ${existing.name}?`,
      'People currently in this queue will be removed. This cannot be undone.',
      [
        { text: 'Keep service', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteService(id);
            router.replace('/admin/services');
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{ title: isNew ? 'New service' : 'Edit service' }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Field
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
          helper="Minutes per person. Used to estimate wait times."
          placeholder="15"
        />

        <View style={styles.priorityBlock}>
          <Text style={[type.label, { marginBottom: spacing.sm }]}>
            Priority level <Text style={styles.required}>(required)</Text>
          </Text>
          <View style={styles.segmented}>
            {PRIORITIES.map((level) => {
              const selected = priority === level;
              const tone = priorityTone[level];
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    setPriority(level);
                    revalidate({ priority: level });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tone.label}
                  style={[
                    styles.segment,
                    selected && { backgroundColor: tone.bg, borderColor: tone.fg },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      selected && { color: tone.fg, fontWeight: '700' },
                    ]}
                  >
                    {level[0].toUpperCase() + level.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helper}>
            Higher priority services are served sooner when queues overlap.
          </Text>
        </View>

        <Button
          label={isNew ? 'Create service' : 'Save changes'}
          onPress={handleSave}
          style={{ marginTop: spacing.sm }}
        />

        {!isNew ? (
          <Button
            label="Delete service"
            variant="danger"
            onPress={handleDelete}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  required: { fontSize: 13, fontWeight: '400', color: colors.slate },
  priorityBlock: { marginBottom: spacing.lg },
  segmented: { flexDirection: 'row' },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  segmentText: { fontSize: 15, color: colors.slate },
  helper: { ...type.secondary, marginTop: spacing.xs },
  missing: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  missingBody: { ...type.secondary, marginTop: spacing.xs },
});
