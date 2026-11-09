/**
 * Shared contracts for the dice engine.
 *
 * This module is types-only. It has no runtime exports; every declaration is a
 * JSDoc typedef so packages can agree on plain-data boundaries without
 * importing a backend implementation.
 */

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Quat
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @typedef {Object} Transform
 * @property {Vec3} position
 * @property {Quat} quaternion
 */

/**
 * @typedef {Object} ViewportMetrics
 * @property {number} containerWidth
 * @property {number} containerHeight
 * @property {number} sceneWidth
 * @property {number} sceneHeight
 * @property {number} scale
 * @property {number} aspect
 * @property {number} wallHeight
 * @property {number} pixelRatio
 */

/**
 * @typedef {Object} Scheduler
 * @property {() => number} now
 * @property {(callback: (time: number) => void) => number} requestFrame
 * @property {(id: number) => void} cancelFrame
 */

/**
 * @typedef {Object} StepResult
 * @property {boolean} continue Whether the loop should keep running.
 * @property {boolean} settled Whether the strategy observed a settled world.
 */

/**
 * @typedef {Object} WorldContract
 * @property {() => boolean} areDiceSettled
 * @property {() => number[]} getValues
 * @property {() => DieContract[]} getDice
 */

/**
 * @typedef {Object} DieContract
 * @property {string} id
 * @property {number} value
 * @property {boolean} selected
 * @property {BodyHandle|null} body
 * @property {VisualHandle|null} visual
 */

/**
 * @typedef {Object} BodyHandle
 * @property {string} id
 * @property {number} mass
 * @property {boolean} isStatic
 * @property {() => Vec3} getPosition
 * @property {() => Quat} getQuaternion
 * @property {() => Vec3} getVelocity
 * @property {() => Vec3} getAngularVelocity
 * @property {() => string} getSleepState
 * @property {(transform: Transform) => void} setTransform
 * @property {(velocity: Vec3) => void} setVelocity
 * @property {(velocity: Vec3) => void} setAngularVelocity
 * @property {(mass: number) => void} setMass
 * @property {(linear: number, angular: number) => void} setDamping
 * @property {(impulse: Vec3, worldPoint?: Vec3) => void} applyImpulse
 * @property {(force: Vec3) => void} applyForce
 * @property {() => void} wakeUp
 */

/**
 * @typedef {Object} VisualHandle
 * @property {string} id
 * @property {(transform: Transform) => void} setTransform
 * @property {(mapping: number[]) => void} setFaceMapping
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} PhysicsWorldContract
 * @property {(body: unknown) => void} removeBody
 * @property {(dt: number) => void} step
 * @property {(x: number, y: number, z: number) => void} setGravity
 * @property {() => Vec3} getGravity
 * @property {(callback: (world: PhysicsWorldContract, dt: number) => void) => void} addPostStep
 * @property {(callback: (world: PhysicsWorldContract, dt: number) => void) => void} removePostStep
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} PhysicsBackend
 * @property {string} id
 * @property {(options?: Record<string, unknown>) => unknown} createWorld
 */

/**
 * @typedef {Object} RenderSceneContract
 * @property {(object: unknown) => unknown} add
 * @property {(object: unknown) => void} remove
 * @property {(metrics: ViewportMetrics) => void} resize
 * @property {() => void} render
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} RenderBackend
 * @property {string} id
 * @property {() => Promise<unknown>} createScene
 */

/**
 * @typedef {Object} PredictionSession
 * @property {(options?: Record<string, unknown>) => unknown} stepUntilSettled
 * @property {() => number[]} getValues
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} ThrowVector
 * @property {Vec3} pos
 * @property {Vec3} velocity
 * @property {number} [angle]
 * @property {Vec3} [axis]
 */

/**
 * @typedef {Object} ThrowPlan
 * @property {ThrowVector[]} vectors
 * @property {string|number} seed
 * @property {number} dice
 * @property {Record<string, unknown>} [spawnProfile]
 */

/**
 * @typedef {Object} RollRequest
 * @property {string} [id]
 * @property {number} [dice]
 * @property {string} [definition]
 * @property {string[]} [keep]
 * @property {number[]} [values]
 * @property {ThrowVector[]} [vectors]
 * @property {number[][]} [faceMappings]
 * @property {string|number} [seed]
 * @property {'standard'|'continuous'} [mode]
 * @property {boolean} [cancelActive]
 */

/**
 * @typedef {Object} RollDieResult
 * @property {string} id
 * @property {number} value
 * @property {boolean} selected
 * @property {Vec3} position
 */

/**
 * @typedef {Object} RollResult
 * @property {string} id
 * @property {number[]} values
 * @property {number} total
 * @property {RollDieResult[]} dice
 * @property {string|number} [seed]
 * @property {number} [durationMs]
 * @property {RollRequest} [request]
 */

/**
 * @typedef {Object} InputSource
 * @property {string} id
 * @property {(host: InputHost) => void} attach
 * @property {() => void} detach
 * @property {(() => Promise<boolean>)} [enable]
 * @property {(() => void)} [disable]
 */

/**
 * @typedef {Object} InputHost
 * @property {(request: RollRequest) => Promise<RollResult>} roll
 * @property {(x: number, y: number, z: number) => void} setGravity
 * @property {(ids: string[], impulse: Vec3, worldPoint?: Vec3) => void} applyImpulse
 * @property {() => string[]} getDiceIds
 * @property {() => string[]} getSelection
 * @property {(ids: string[]) => void} setSelection
 * @property {(id: string) => void} toggleSelection
 * @property {(ndc: { x: number, y: number }) => unknown} pick
 * @property {() => ViewportMetrics} getMetrics
 * @property {() => Record<string, unknown>} getSpawnProfile
 * @property {{ on: Function, off: Function, emit: Function }} events
 */

/**
 * @typedef {Object} EnginePlugin
 * @property {string} id
 * @property {(engine: unknown) => void} attach
 * @property {(engine: unknown) => void} [detach]
 * @property {(request: RollRequest) => Promise<{ request?: RollRequest, faceMappings?: number[][], diagnostics?: object } | void>} [prepareRoll]
 * @property {(result: RollResult) => void} [afterRoll]
 */

/**
 * @typedef {Object} EnclosureDefinition
 * @property {string} id
 * @property {string} type
 * @property {Record<string, unknown>} [options]
 */

/**
 * @typedef {Object} DicePreset
 * @property {string} definition
 * @property {number} count
 * @property {string} [style]
 */

/**
 * @typedef {Object} ControlItem
 * @property {string} id
 * @property {'select'|'range'|'number'|'text'|'toggle'|'button'} type
 * @property {string} label
 * @property {unknown} [value]
 * @property {Array<{ value: string, label: string }>} [options]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {boolean} [disabled]
 * @property {string} [testId]
 */

/**
 * @typedef {Object} ContentPack
 * @property {string} id
 * @property {number} [version]
 * @property {string} [label]
 * @property {Record<string, unknown>} [enclosure]
 * @property {Record<string, unknown>} [table]
 * @property {Record<string, unknown>} [camera]
 * @property {Record<string, unknown>} [dice]
 * @property {Record<string, unknown>} [physics]
 * @property {Record<string, unknown>} [scenarios]
 */

/**
 * @typedef {Object} EngineReadyPayload
 * @property {string} engineId
 */

/**
 * @typedef {Object} EngineErrorPayload
 * @property {string} scope
 * @property {Error} error
 */

/**
 * @typedef {Object} LoopStartPayload
 * @property {number} runId
 * @property {string} mode
 */

/**
 * @typedef {Object} LoopStopPayload
 * @property {number} runId
 * @property {string} reason
 */

/**
 * @typedef {Object} TickPayload
 * @property {number} iteration
 * @property {number} dt
 * @property {number} elapsed
 */

/**
 * @typedef {Object} RollStartPayload
 * @property {string} rollId
 * @property {RollRequest} request
 */

/**
 * @typedef {Object} RollProgressPayload
 * @property {string} rollId
 * @property {boolean} settled
 * @property {number} total
 */

/**
 * @typedef {Object} RollSettlePayload
 * @property {string} rollId
 * @property {RollResult} result
 */

/**
 * @typedef {Object} RollCancelPayload
 * @property {string} rollId
 * @property {string} reason
 */

/**
 * @typedef {Object} DieSpawnPayload
 * @property {string} dieId
 * @property {number} index
 */

/**
 * @typedef {Object} DieRemovePayload
 * @property {string} dieId
 */

/**
 * @typedef {Object} DiePickPayload
 * @property {string} dieId
 * @property {Vec3} point
 */

/**
 * @typedef {Object} DieSelectPayload
 * @property {string} dieId
 * @property {boolean} selected
 */

/**
 * @typedef {Object} EnclosureChangePayload
 * @property {string} type
 * @property {string} [preset]
 */

/**
 * @typedef {Object} GravityPayload
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} MotionStatusPayload
 * @property {string} status
 * @property {string} [message]
 */

/**
 * @typedef {Object} ResultPresentPayload
 * @property {number[]} values
 * @property {number} total
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {{
 *   'engine:ready': EngineReadyPayload,
 *   'engine:resize': ViewportMetrics,
 *   'engine:error': EngineErrorPayload,
 *   'loop:start': LoopStartPayload,
 *   'loop:pause': { runId: number },
 *   'loop:resume': { runId: number },
 *   'loop:stop': LoopStopPayload,
 *   'tick': TickPayload,
 *   'roll:start': RollStartPayload,
 *   'roll:progress': RollProgressPayload,
 *   'roll:settle': RollSettlePayload,
 *   'roll:cancel': RollCancelPayload,
 *   'die:spawn': DieSpawnPayload,
 *   'die:remove': DieRemovePayload,
 *   'die:pick': DiePickPayload,
 *   'die:select': DieSelectPayload,
 *   'enclosure:change': EnclosureChangePayload,
 *   'physics:gravity': GravityPayload,
 *   'motion:status': MotionStatusPayload,
 *   'result:present': ResultPresentPayload
 * }} EventMap
 */

export {};
