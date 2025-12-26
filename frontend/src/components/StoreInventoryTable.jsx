import React from 'react';

const StoreInventoryTable = ({ items, userRole }) => {
    // Determine if we need to show the Officer column
    // The requirement is: "store manager get a whole view... corresponding to his name" (Officer name)
    const showOfficerColumn = userRole === 'STORE_MANAGER' || userRole === 'ADMIN';

    if (!items || items.length === 0) {
        return <p style={{ padding: '1rem', color: '#ccc' }}>No inventory items found.</p>;
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '0.75rem' }}>Code</th>
                        <th style={{ padding: '0.75rem' }}>Material</th>
                        <th style={{ padding: '0.75rem' }}>Category</th>
                        <th style={{ padding: '0.75rem' }}>Qty</th>
                        <th style={{ padding: '0.75rem' }}>Unit</th>
                        <th style={{ padding: '0.75rem' }}>Location</th>
                        <th style={{ padding: '0.75rem' }}>Inward Date</th>
                        {showOfficerColumn && <th style={{ padding: '0.75rem', color: 'var(--accent)' }}>Officer</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.75rem' }}>{item.material_code}</td>
                            <td style={{ padding: '0.75rem' }}>{item.material_name}</td>
                            <td style={{ padding: '0.75rem' }}>{item.category}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{item.quantity}</td>
                            <td style={{ padding: '0.75rem' }}>{item.unit}</td>
                            <td style={{ padding: '0.75rem' }}>
                                {item.store_room ? `${item.store_room} / ${item.rack_no} / ${item.shelf_no}` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                                {item.inward_date ? new Date(item.inward_date).toLocaleDateString() : '-'}
                            </td>
                            {showOfficerColumn && (
                                <td style={{ padding: '0.75rem', color: 'var(--accent-light)' }}>
                                    {item.officer_name || 'N/A'}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default StoreInventoryTable;
