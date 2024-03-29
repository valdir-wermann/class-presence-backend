const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Student = require('../models/Student');

const _ = require('underscore');

class AttendanceController {
    findAll(req, res) {
        const { studentId, teacherId, classId, groupBy, count } = req.query;

        const where = {};
        if (req.student) {
            where.studentId = req.student._id;
        } else if (studentId) {
            where.studentId = studentId;
        }
        if (teacherId) where.teacherId = teacherId;
        if (classId) where.classId = classId;

        Attendance
            .find(where)
            .sort({ date: 'desc' })
            .then(async attendance => {
                if (count === 'true') {
                    attendance = _.groupBy(attendance, (at) => at.classId);
                    const classes = await Class.find({ _id: { $in: Object.keys(attendance) } });
                    attendance = classes.reduce((prev, cur) => {
                        prev[cur.name] = attendance[cur._id];
                        return prev;
                    }, {});

                    const map = {};
                    Object.entries(attendance).forEach(([key, value]) => {
                        map[key] = value.reduce((prev, cur) => {
                            prev[cur.type] += cur.periods;
                            return prev;
                        }, { presente: 0, atrasado: 0, ausente: 0, fj: 0 });
                    });

                    return res.status(200).json(map);
                }

                if (groupBy === 'classId') {
                    attendance = _.groupBy(attendance, (at) => at.classId);
                    const classes = await Class.find({ _id: { $in: Object.keys(attendance) } });
                    attendance = classes.reduce((prev, cur) => {
                        prev[cur.name] = attendance[cur._id];
                        return prev;
                    }, {});
                };

                res.status(200).json(attendance);
            })
            .catch(error => res.status(400).json({ error }));
    }

    findOne(req, res) {
        Attendance
            .findById(req.params.id)
            .then(attendance => res.status(200).json(attendance))
            .catch(error => res.status(400).json(error));
    }

    async create(req, res) {
        const classId = req.params.id;
        let { students, description, date, periods } = req.body;
        const teacherId = req.teacher._id;

        students = students.map(student => {
            return {
                studentId: student.studentId,
                teacherId,
                classId,
                type: student.type,
                description,
                date,
                periods
            };
        });

        try {
            const saved = await Attendance.insertMany(students);
            res.status(200).json(saved);
        } catch (error) {
            res.status(400).json({ error });
        }
    }

    async update(req, res) {
        const { type, date, desc, periods } = req.body;

        const updateAttendance = {};
        if (type) {
            updateAttendance.type = type;
            const a = await Attendance.findById(req.params.id);
            if (!a) res.status(404).json({ err: 'Not found!' })

            if (a.teacherId === req.teacher._id) {
                Attendance
                    .findByIdAndUpdate(req.params.id, updateAttendance)
                    .then((attend) => res.status(200).json(attend))
                    .catch((error) => res.status(400).json(error));
            } else {
                res.status(403).json({ error: 'Not allowed to do that!' })
            }
        }
        if (date || desc || periods) {
            if (date) updateAttendance.date = date;
            if (desc) updateAttendance.description = desc.toUpperCase();
            if (periods) updateAttendance.periods = periods;

            console.log(updateAttendance);

            const a = await Attendance.findById(req.params.id);
            if (!a) res.status(404).json({ err: 'Not found!' });
            
            try {
                if (a.teacherId === req.teacher._id) {
                    Attendance.updateMany({teacherId: a.teacherId, date: a.date, description: a.description, periods: a.periods}, updateAttendance)
                      .then((attend) => res.status(200).json(attend))
                      .catch((error) => res.status(400).json(error));
                } else {
                    res.status(403).json({ error: 'Not allowed to do that!' })
                }
            } catch(error) {
                res.status(400).json({ error });
            }
        }

    }
    async delete(req, res) {
        const a = await Attendance.findById(req.params.id);
        if (!a) return res.status(404).json({ msg: "attendance not found!" });
        const { date, teacherId, classId, description } = a;
        if (!teacherId.includes(req.teacher._id)) return res.status(401).json({ error: 'You are not allowed to delete others attendance!' });

        try {
            await Attendance.deleteMany({ date, teacherId, classId, description });
            res.status(200).json({ msg: 'Successfully deleted!' });
        } catch (e) {
            res.status(400).json({ error: 'Something went wrong!' })
        }

    }

    async lessonAttendance(req, res) {
        try {
            const attendance = await Attendance.findById(req.params.id);
            let { date, classId, teacherId } = attendance;

            const attendances = await Attendance.find({ date, classId, teacherId });
            let students = await Student.find({ _id: { $in: attendances.map(at => at.studentId) } }).sort('name');
            students = _.groupBy(students, '_id');

            date = new Date(date);

            const typeMap = {
                'presente': 'PRESENTE',
                'ausente': 'AUSENTE',
                'atrasado': 'ATRASADO',
                'fj': 'FALTA JUSTIFICADA'
            }
            const month = date.getMonth() + 1;
            const normalize = (s) => {
                s = s.toString();
                if (s.length === 1) return '0' + s;
                return s;
            }
            let csvWriting = [
                ['Cartão', 'Nome', 'Tipo', `Dia: ${normalize(date.getDate())}/${normalize(month)}/${date.getFullYear()} por ${attendance.periods} períodos`]
            ];
            Object.values(students).forEach(stud => {
                const tipo = attendances.find(_ => _.studentId == stud[0]._id);
                csvWriting.push([stud[0].card,stud[0].name,typeMap[tipo.type]])
            })

            res.status(200).json(csvWriting);
        }
        catch (error) {
            res.status(400).json(error);
        }
    }
}

module.exports = new AttendanceController();