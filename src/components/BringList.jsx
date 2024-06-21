import * as React from 'react';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';
import { collection,  deleteDoc,  doc,  getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import {db} from '../firebase'
import Button from '@mui/material/Button';
import { Menu } from './Menu';
import { Typography } from '@mui/material';
import DeleteButton from './DeleteButton';
import EditButton from './EditButton';
import ReturnButton from './ReturnButtun';
import { useUser } from './UserContext';



export const BringList = () => {
  const { user } = useUser();

  const isAuthorized = user && user.email === 'hayato.yagyu@digitalsoft.co.jp';
  
  const columns = [
    {
      field: 'deleteBtn',
      headerName: '削除',
      sortable: false,
      width: 90,
      disableClickEventBubbling: true,
      renderCell: (params) => <DeleteButton rowId={ params.id } sharedState={posts} setSharedState={setPosts} disabled={!isAuthorized}/>,
      
    },
    {
      field: 'editBtn',
      headerName: '編集',
      sortable: false,
      width: 90,
      disableClickEventBubbling: true,
      renderCell: (params) => <EditButton rowData={params.row} setSharedState={setPosts} disabled={!isAuthorized}/>,
      
    },
    {
      field: 'returnBtn',
      headerName: '返却申請',
      sortable: false,
      width: 100,
      disableClickEventBubbling: true,
      renderCell: (params) => <ReturnButton rowId={ params.id } rowData={params.row} sharedState={posts} setSharedState={setPosts} />,
      
    },
    { field: 'id', headerName: 'ID', width: 110 },
    {
      field: 'applicantdate',
      headerName: '申請日.',
      width: 150,
      editable: false,
    },
    {
      field: 'applicant',
      headerName: '申請者.',
      width: 150,
      editable: false,
    },
    {
      field: 'classification',
      headerName: '持込・持出区分',
      width: 150,
      editable: false,
    },
    {
      field: 'periodfrom',
      headerName: '持込・持出日 から',
      width: 150,
      editable: false,
    },
    {
      field: 'periodto',
      headerName: '持込・持出日 まで',
      width: 150,
      editable: false,
    },
    {
      field: 'where',
      headerName: '持込・持出先',
      width: 200,
      editable: false,
    },
    {
      field: 'materials',
      headerName: 'データまたは資料名',
      width: 400,
      editable: false,
    },
    {
      field: 'media',
      headerName: '媒体・ＰＣ 設備番号',
      width: 150,
      editable: false,
    },
    {
      field: 'permitdate',
      headerName: '許可日',
      width: 150,
      editable: false,
    },
    {
      field: 'permitstamp',
      headerName: '許可者',
      width: 150,
      editable: false,
    },
    {
      field: 'confirmationdate',
      headerName: '持出返却 確認日',
      width: 150,
      editable: false,
    },
    {
      field: 'confirmationstamp',
      headerName: '確認者',
      width: 150,
      editable: false,
    },
  ];

  const [posts, setPosts] = useState([]);

    useEffect(() => {
      const fetchPosts = async () => {
        try {
          const usersCollectionRef = collection(db, 'posts');
          const querySnapshot = await getDocs(usersCollectionRef);
          const postData = querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
          setPosts(postData);
          console.count("useEffect")
        } catch (error) {
          console.error('Error fetching posts:', error);
        }
      };
  
      fetchPosts();
    }, []); 

    console.count("レンダリング")

    const defaultSortModel = [
      {
        field: 'applicantdate',
        sort: 'desc', // デフォルトのソート順を降順に設定
      },
    ];

  return (
    <>
    <Menu />
    <Box sx={{ height: '100%', width: 'auto'}}>
      <Typography variant='h4' align='center' borderBottom={'2px solid gray'}>媒体等持込持出一覧</Typography>
      <br />
      <DataGrid
        rows={posts}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 20,
            },
          },
        }}
        pageSizeOptions={[20]}
        checkboxSelection={false}
        disableRowSelectionOnClick={true}
        sortModel={defaultSortModel}
       
      />
    </Box>
    </>
  )
}
export default BringList;