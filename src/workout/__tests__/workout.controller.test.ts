import request from "supertest";
import { app } from "../../app";
import prisma from "../../prisma";
import { resetDatabase } from "../../test/utils";

describe("Workout routes", () => {
    let authToken: string;
    let userId: string;
    let exerciseId1: string;
    let exerciseId2: string;

    beforeEach(async () => {
        await resetDatabase();

        // Create a test user and get auth token
        const registerRes = await request(app)
            .post("/auth/register")
            .send({ 
                email: "workout@test.com", 
                username: "workoutuser", 
                password: "password123" 
            });
        
        authToken = registerRes.body.token;
        userId = registerRes.body.user.id;

        // Create test exercises
        const exercise1 = await prisma.exercise.create({
            data: { name: "Bench Press", category: "chest" }
        });
        const exercise2 = await prisma.exercise.create({
            data: { name: "Squat", category: "legs" }
        });

        exerciseId1 = exercise1.id;
        exerciseId2 = exercise2.id;
    });

    describe("POST /workout", () => {
        it("should create a workout with exercises and sets", async () => {
            const workoutData = {
                durationMinutes: 60,
                note: "Great workout today!",
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 },
                            { setNumber: 2, repetitions: 8, weight: 110 }
                        ]
                    },
                    {
                        exerciseId: exerciseId2,
                        order: 2,
                        sets: [
                            { setNumber: 1, repetitions: 12, weight: 80 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("id");
            expect(res.body.userId).toBe(userId);
            expect(res.body.durationMinutes).toBe(60);
            expect(res.body.note).toBe("Great workout today!");
            expect(res.body.workoutExercises).toHaveLength(2);
            
            // Check first exercise
            const firstExercise = res.body.workoutExercises.find((we: any) => we.order === 1);
            expect(firstExercise.exerciseId).toBe(exerciseId1);
            expect(firstExercise.exercise.name).toBe("Bench Press");
            expect(firstExercise.sets).toHaveLength(2);
            expect(firstExercise.sets[0].repetitions).toBe(10);
            expect(firstExercise.sets[0].weight).toBe(100);
        });

        it("should create a workout without a note", async () => {
            const workoutData = {
                durationMinutes: 45,
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(201);
            expect(res.body.note).toBeNull();
        });

        it("should fail without authentication", async () => {
            const workoutData = {
                durationMinutes: 60,
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .send(workoutData);

            expect(res.status).toBe(401);
        });

        it("should fail with missing required fields (no exercises)", async () => {
            const workoutData = {
                durationMinutes: 60,
                exercises: []
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Missing required fields");
        });

        it("should fail with negative duration", async () => {
            const workoutData = {
                durationMinutes: -10,
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Duration must not be negative");
        });

        it("should fail with non-existent exercise", async () => {
            const workoutData = {
                durationMinutes: 60,
                exercises: [
                    {
                        exerciseId: "00000000-0000-0000-0000-000000000000",
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("one or more exercises not found");
        });

        it("should fail when one of multiple exercises doesn't exist", async () => {
            const workoutData = {
                durationMinutes: 60,
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    },
                    {
                        exerciseId: "00000000-0000-0000-0000-000000000000",
                        order: 2,
                        sets: [
                            { setNumber: 1, repetitions: 10, weight: 100 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("one or more exercises not found");
        });

        it("should create workout with multiple sets per exercise", async () => {
            const workoutData = {
                durationMinutes: 90,
                exercises: [
                    {
                        exerciseId: exerciseId1,
                        order: 1,
                        sets: [
                            { setNumber: 1, repetitions: 12, weight: 80 },
                            { setNumber: 2, repetitions: 10, weight: 90 },
                            { setNumber: 3, repetitions: 8, weight: 100 },
                            { setNumber: 4, repetitions: 6, weight: 110 }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send(workoutData);

            expect(res.status).toBe(201);
            expect(res.body.workoutExercises[0].sets).toHaveLength(4);
            expect(res.body.workoutExercises[0].sets[3].weight).toBe(110);
        });
    });

    describe("GET /workout", () => {
        // Helper function to create a workout
        const createWorkout = async (startedAt: string, durationMinutes: number) => {
            return await prisma.workout.create({
                data: {
                    userId,
                    startedAt: new Date(startedAt),
                    durationMinutes,
                    workoutExercises: {
                        create: [
                            {
                                exerciseId: exerciseId1,
                                order: 1,
                                sets: {
                                    create: [
                                        { setNumber: 1, repetitions: 10, weight: 100 }
                                    ]
                                }
                            }
                        ]
                    }
                }
            });
        };

        it("should return empty array when user has no workouts", async () => {
            const res = await request(app)
                .get("/workout")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toEqual([]);
            expect(res.body.pagination.totalWorkouts).toBe(0);
            expect(res.body.pagination.totalPages).toBe(0);
        });

        it("should return paginated workouts with default pagination", async () => {
            // Create 3 workouts
            await createWorkout("2025-10-29T10:00:00Z", 30);
            await createWorkout("2025-10-30T10:00:00Z", 45);
            await createWorkout("2025-10-31T10:00:00Z", 60);

            const res = await request(app)
                .get("/workout")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toHaveLength(3);
            expect(res.body.pagination).toEqual({
                currentPage: 1,
                totalPages: 1,
                totalWorkouts: 3,
                limit: 10,
                hasNextPage: false,
                hasPreviousPage: false
            });

            // Check workouts are ordered by most recent first
            expect(res.body.workouts[0].durationMinutes).toBe(60); // Oct 31
            expect(res.body.workouts[1].durationMinutes).toBe(45); // Oct 30
            expect(res.body.workouts[2].durationMinutes).toBe(30); // Oct 29
        });

        it("should return workouts with nested exercises and sets", async () => {
            await createWorkout("2025-10-31T10:00:00Z", 60);

            const res = await request(app)
                .get("/workout")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts[0]).toHaveProperty("workoutExercises");
            expect(res.body.workouts[0].workoutExercises).toHaveLength(1);
            expect(res.body.workouts[0].workoutExercises[0].exercise).toEqual({
                id: exerciseId1,
                name: "Bench Press",
                category: "chest"
            });
            expect(res.body.workouts[0].workoutExercises[0].sets).toHaveLength(1);
            expect(res.body.workouts[0].workoutExercises[0].sets[0]).toMatchObject({
                setNumber: 1,
                repetitions: 10,
                weight: 100
            });
        });

        it("should handle custom page size", async () => {
            // Create 5 workouts
            for (let i = 1; i <= 5; i++) {
                await createWorkout(`2025-10-${25 + i}T10:00:00Z`, i * 10);
            }

            const res = await request(app)
                .get("/workout?limit=2")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toHaveLength(2);
            expect(res.body.pagination).toEqual({
                currentPage: 1,
                totalPages: 3,
                totalWorkouts: 5,
                limit: 2,
                hasNextPage: true,
                hasPreviousPage: false
            });
        });

        it("should handle page navigation", async () => {
            // Create 5 workouts
            for (let i = 1; i <= 5; i++) {
                await createWorkout(`2025-10-${25 + i}T10:00:00Z`, i * 10);
            }

            // Get page 2 with limit 2
            const res = await request(app)
                .get("/workout?page=2&limit=2")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toHaveLength(2);
            expect(res.body.pagination).toEqual({
                currentPage: 2,
                totalPages: 3,
                totalWorkouts: 5,
                limit: 2,
                hasNextPage: true,
                hasPreviousPage: true
            });

            // Verify it's showing different workouts (40 and 30 minutes)
            expect(res.body.workouts[0].durationMinutes).toBe(30);
            expect(res.body.workouts[1].durationMinutes).toBe(20);
        });

        it("should handle last page correctly", async () => {
            // Create 5 workouts
            for (let i = 1; i <= 5; i++) {
                await createWorkout(`2025-10-${25 + i}T10:00:00Z`, i * 10);
            }

            // Get page 3 (last page) with limit 2
            const res = await request(app)
                .get("/workout?page=3&limit=2")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toHaveLength(1); // Only 1 workout on last page
            expect(res.body.pagination).toEqual({
                currentPage: 3,
                totalPages: 3,
                totalWorkouts: 5,
                limit: 2,
                hasNextPage: false,
                hasPreviousPage: true
            });
        });

        it("should return empty array for page beyond total pages", async () => {
            await createWorkout("2025-10-31T10:00:00Z", 60);

            const res = await request(app)
                .get("/workout?page=10")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.workouts).toEqual([]);
            expect(res.body.pagination.currentPage).toBe(10);
            expect(res.body.pagination.totalPages).toBe(1);
        });

        it("should fail without authentication", async () => {
            const res = await request(app).get("/workout");

            expect(res.status).toBe(401);
        });

        it("should fail with negative page number", async () => {
            const res = await request(app)
                .get("/workout?page=-1")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Page must be at least 1");
        });

        it("should fail with limit greater than 100", async () => {
            const res = await request(app)
                .get("/workout?limit=101")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Limit must be between 1 and 100");
        });

        it("should only return workouts for authenticated user", async () => {
            // Create workout for first user
            await createWorkout("2025-10-31T10:00:00Z", 60);

            // Create second user
            const user2Res = await request(app)
                .post("/auth/register")
                .send({
                    email: "user2@test.com",
                    username: "user2",
                    password: "password123"
                });

            const user2Token = user2Res.body.token;
            const user2Id = user2Res.body.user.id;

            // Create workout for second user
            await prisma.workout.create({
                data: {
                    userId: user2Id,
                    startedAt: new Date("2025-10-31T10:00:00Z"),
                    durationMinutes: 90,
                    workoutExercises: {
                        create: [
                            {
                                exerciseId: exerciseId1,
                                order: 1,
                                sets: {
                                    create: [
                                        { setNumber: 1, repetitions: 10, weight: 100 }
                                    ]
                                }
                            }
                        ]
                    }
                }
            });

            // First user should only see their workout
            const res1 = await request(app)
                .get("/workout")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res1.status).toBe(200);
            expect(res1.body.workouts).toHaveLength(1);
            expect(res1.body.workouts[0].durationMinutes).toBe(60);

            // Second user should only see their workout
            const res2 = await request(app)
                .get("/workout")
                .set("Authorization", `Bearer ${user2Token}`);

            expect(res2.status).toBe(200);
            expect(res2.body.workouts).toHaveLength(1);
            expect(res2.body.workouts[0].durationMinutes).toBe(90);
        });

        it("should handle non-numeric page and limit gracefully", async () => {
            await createWorkout("2025-10-31T10:00:00Z", 60);

            const res = await request(app)
                .get("/workout?page=abc&limit=xyz")
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            // Should default to page 1, limit 10
            expect(res.body.pagination.currentPage).toBe(1);
            expect(res.body.pagination.limit).toBe(10);
        });
    });
    describe("DELETE /workout", () => {
        it("should delete a workout", async () => {
            // Create a workout to delete
            const workout = await prisma.workout.create({
                data: {
                    userId,
                    startedAt: new Date(),
                    durationMinutes: 60,
                    workoutExercises: {
                        create: [
                            {
                                exerciseId: exerciseId1,
                                order: 1,
                                sets: {
                                    create: [
                                        { setNumber: 1, repetitions: 10, weight: 100 }
                                    ]
                                }
                            }
                        ]
                    }
                }
            });

            const res = await request(app)
                .delete("/workout")
                .set("Authorization", `Bearer ${authToken}`)
                .send({ workoutId: workout.id });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Workout deleted successfully");

            // Verify workout is deleted
            const deletedWorkout = await prisma.workout.findUnique({
                where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
        });
    })
})