export function getPeriodFromDate(date: Date): string | undefined {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return undefined;
    }

    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (dayOfWeek - 1));

    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);

    const mondayStr = toYYMMDD(monday);
    const fridayStr = toYYMMDD(friday);

    return `${mondayStr}-${fridayStr}`;
}

export function toYYMMDD(date: Date): string {
    const yy = (date.getFullYear() % 100).toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return yy + mm + dd;
} 
