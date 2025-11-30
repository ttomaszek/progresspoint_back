import { PrismaClient } from '../generated/prisma';
import { hashPassword} from '../src/utils/hash';

const prisma = new PrismaClient();

async function main() {
  // ---- USERS ----
  const users = await prisma.user.createMany({
    data: [
      { email: 'test@gmail.com', username: 'test', passwordHash: await hashPassword('test') },
      { email: 'test1@gmail.com', username: 'test1', passwordHash: await hashPassword('test1') },
    ],
    skipDuplicates: true,
  });

  // ---- EXERCISES ----
  const exercises = await prisma.exercise.createMany({
    data: [
      { name: 'Bench Press', category: 'Chest' },
      { name: 'Squat', category: 'Legs' },
      { name: 'Pull Up', category: 'Back' },
      { name: 'Deadlift', category: 'Back' },
      { name: 'Overhead Press', category: 'Shoulders' },
      { name: 'Bicep Curl', category: 'Arms' },
      { name: 'Tricep Extension', category: 'Arms' },
      { name: 'Quad extensions', category: 'Legs' },
      { name: 'Hamstring Curls', category: 'Legs' },
      { name: 'Barbell Row', category: 'Back' },
      { name: 'Lat Pulldown', category: 'Back' },
      { name: 'Chest Fly', category: 'Chest' },
      { name : 'Leg Press', category: 'Legs' },
      { name: 'Calf Raise', category: 'Legs' },
      { name: 'Dumbbell Shoulder Press', category: 'Shoulders' },
      { name: 'Lateral Raise', category: 'Shoulders' },
      { name: 'Hammer Curl', category: 'Arms' },
      { name: 'Dip', category: 'Arms' }
    ],
    skipDuplicates: true,
  });

  // get users and exercises
  const [test, test1] = await prisma.user.findMany({ where: { username: { in: ['test', 'test1'] } } });
  const allExercises = await prisma.exercise.findMany();

  // ---- WORKOUTS ----
  const workoutTest = await prisma.workout.create({
    data: {
      userId: test.id,
      startedAt: new Date(),
      durationMinutes: 60,
      note: 'First workout',
      isTemplate: false,
    },
  });

  // ---- WORKOUT_EXERCISES ----
  const bench = allExercises.find(e => e.name === 'Bench Press')!;
  const squat = allExercises.find(e => e.name === 'Squat')!;

  const we1 = await prisma.workoutExercise.create({
    data: {
      workoutId: workoutTest.id,
      exerciseId: bench.id,
      order: 1,
    },
  });

  const we2 = await prisma.workoutExercise.create({
    data: {
      workoutId: workoutTest.id,
      exerciseId: squat.id,
      order: 2,
    },
  });

  // ---- SETS ----
  await prisma.set.createMany({
    data: [
      { workoutExerciseId: we1.id, setNumber: 1, repetitions: 10, weight: 50 },
      { workoutExerciseId: we1.id, setNumber: 2, repetitions: 8, weight: 55 },
      { workoutExerciseId: we2.id, setNumber: 1, repetitions: 12, weight: 80 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed finished!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
