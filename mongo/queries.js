// mongosh skydesk < mongo/queries.js     (or paste block by block)
// A1  Average and worst departure delay + on-time % per airline
db.flight_events.aggregate([
  { $match: { event_type: 'DEPARTURE_ACTUAL' } },
  { $group: { _id: '$airline_code', departures: { $sum: 1 }, avg_delay: { $avg: '$delay_minutes' },
              max_delay: { $max: '$delay_minutes' },
              on_time: { $sum: { $cond: [{ $lte: ['$delay_minutes', 15] }, 1, 0] } } } },
  { $addFields: { on_time_pct: { $round: [{ $multiply: [{ $divide: ['$on_time', '$departures'] }, 100] }, 1] } } },
  { $sort: { avg_delay: -1 } }
]);

// A2  Top delay reasons
db.flight_events.aggregate([
  { $match: { event_type: 'DELAY' } },
  { $group: { _id: '$meta.reason', incidents: { $sum: 1 }, total_minutes: { $sum: '$delay_minutes' } } },
  { $sort: { total_minutes: -1 } }, { $limit: 5 }
]);

// A3  Delay trend per week ($dateTrunc, MongoDB 5.0+)
db.flight_events.aggregate([
  { $match: { event_type: 'DEPARTURE_ACTUAL' } },
  { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'week' } }, avg_delay: { $avg: '$delay_minutes' }, n: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// A4  Full scan trail of one bag (uses index {baggage_id:1, ts:1})
db.baggage_events.find({ baggage_id: 1 }).sort({ ts: 1 });

// A5  Bags that skipped the SECURITY checkpoint (should be empty!)
db.baggage_events.aggregate([
  { $group: { _id: '$baggage_id', checkpoints: { $addToSet: '$checkpoint' } } },
  { $match: { checkpoints: { $in: ['LOADING_BAY'], $nin: ['SECURITY'] } } }
]);

// A6  Show indexes and validators
db.flight_events.getIndexes();
db.getCollectionInfos({ name: 'flight_events' })[0].options.validator;

// A8  Validator in action - this insert must FAIL (bad event_type)
db.flight_events.insertOne({ flight_id: 1, flight_number: 'AI501', event_type: 'BANANA', ts: new Date() });
