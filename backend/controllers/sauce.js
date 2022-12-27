// J'importe ma constante 'Sauce'
const Sauce = require('../models/Sauce');
// Je crée ma constante 'fs' qui donne accès aux fonctions qui permettent de modifier le système de fichiers
const fs = require('fs');
const { request } = require('http');


// J'exporte la fonction createSauce pour la création d'une sauce
exports.createSauce =  (req, res, next) => {
// Je crée une constante contenant la nouvelle instance de notre modèle 'sauce': JSON.parse() transformera un objet stringifié en Object JavaScript exploitable.
const sauceObject = JSON.parse(req.body.sauce);
delete sauceObject._id;
// Je supprime le champ "_userId" de la requête envoyée par le client
delete sauceObject._userId;
const sauce = new Sauce({
    ...sauceObject,
    userId: req.auth.userId,
    // Je reconstruis l'URL complète du fichier enregistré
    imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
});
  //J'enregistre cet objet dans la base de données
  sauce
  .save()
  .then(() => { res.status(201).json({message: 'Sauce enregistrée !'})})
  .catch(error => { res.status(400).json( { error })})
};

// J'exporte la fonction 'modifySauce' pour la modification d'une sauce
exports.modifySauce = (req, res, next) => {
  const sauceObject = req.file ? {
      ...JSON.parse(req.body.sauce),
      imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  } : { ...req.body };

  delete sauceObject._userId;
  Sauce.findOne({_id: req.params.id})
      .then((sauce) => {
          if (sauce.userId != req.auth.userId) {
              res.status(401).json({ message : 'Not authorized'});
          } else {
              Sauce.updateOne({ _id: req.params.id}, { ...sauceObject, _id: req.params.id})
              .then(() => res.status(200).json({message : 'Objet modifié!'}))
              .catch(error => res.status(401).json({ error }));
          }
      })
      .catch((error) => {
          res.status(400).json({ error });
      });
};


// J'exporte la fonction 'deleteSauce' pour la suppression d'une sauce
exports.deleteSauce = (req, res, next) => {
  Sauce.findOne({ _id: req.params.id})
      .then(sauce => {
          if (sauce.userId != req.auth.userId) {
              res.status(401).json({message: 'Non autorisé ! '});
          } else {
              const filename = sauce.imageUrl.split('/images/')[1];
              fs.unlink(`images/${filename}`, () => {
                  Sauce.deleteOne({_id: req.params.id})
                      .then(() => { res.status(200).json({message: 'Sauce supprimée !'})})
                      .catch(error => res.status(401).json({ error }));
              });
          }
      })
      .catch( error => {
          res.status(500).json({ error });
      });
};

// J'exporte la fonction 'getOneSauce' pour la récupérer une sauce
exports.getOneSauce = (req, res, next) => {
    Sauce.findOne({
      _id: req.params.id
    }).then(
      (sauce) => {
        res.status(200).json(sauce);
      }
    ).catch(
      (error) => {
        res.status(404).json({
          error: error
        });
      }
    );
  };

// J'exporte la fonction 'getAllSauce' pour récupérer toutes les sauces
exports.getAllSauce =  (req, res, next) => {
  Sauce.find().then(
    (sauces) => {
      res.status(200).json(sauces);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};



// J'exporte la fonction de "like/dislike" pour les sauces (like = 1, dislike = -1)

//Etape 1: Vérifier si dans le tableau 'userLiked', il existe déjà l'id de la personne qui vient de cliquer sur le pouce up
//Etape 2: Si déjà présent, ne rien faire
//Etape 2: Si inexistant, l'ajouter au tableau 'userLiked' + faire un like + 1 dans la base de données
//Etape 3: Si l'utilisateur ne like pas et ne dislike pas : Le supprimer du tableau 'userLiked' s'il est présent, et le supprimer du tableau 'userDisliked' s'il est présent.
//Etape 4: Vérifier dans le tableau 'userDisliked', si l'id de la personne qui vient de cliquer sur le pouce down existe déjà
//Etape 5: Si déjà présent, ne rien faire
//Etape 5 : Si inexistant, l'ajouter au tableau des 'userDisliked' + faire un dislike +1
//Etape 6: Le user avait liké la sauce puis la dislike : Il faudra supprimer l'id du user dans le tableau "userLiked", et en même temps ajouter l'id du user dans le tableau 'userDisliked'

exports.likeDislikeSauce = (req,res,next) => {
  // Je vérifie que la sauce à liker existe bien :
  Sauce.findOne({
    _id: req.params.id
  })
  .then(
    (sauce) => {
      console.log(sauce);

    //  Si like = 1  //

    // Si l'utilisateur n'a pas encore liké la sauce (donc n'est pas présent dans le tableau des userLiked), mais clique sur like
    if (!sauce.usersLiked.includes(request.body.userId) && req.body.like === 1){
  
      // Je crée ma constante 'action', lorsqu'un utilisateur clique sur le like
      const action = req.body.like;  
      // Alors je mets à jour la sauce dans la base de données
      Sauce.updateOne({
        // Je cherche la sauce dans la base de données
        _id: req.params.id,
      },
        // Ici il faut incrémenter dans le champ(tableau) l'utilisateur qui a liké
        {
          // J'ajoute like + 1 avec la méthode inc
          $inc: { likes: 1 },
          // Je rajoute le usersLiked avec la méthode push
          $push: { usersLiked: req.auth.userId },
        }
        
        )
        .then(() => res.status(201).json({ message: "Sauce like +1 !" }))
        .catch((error) => res.status(400).json(" error "));
      }
    
     // Si pas de like ( like = 0 => Pas de vote) //

  //Si action = 0 ( C'est à dire si l'utilisateur ne vote pas), mais que l'utilisateur est déjà présent dans le tableau userLiked
  if (sauce.usersLiked.includes(request.body.userId) && req.body.like === 0){
    // Mise à jour de la sauce dans la base de données
    Sauce.updateOne({
      // Je cherche la sauce dans la base de données
      _id: req.params.id,
    },
    // Ici je met à jour le tableau des likes: Si l'utilisateur était présent, il doit être supprimé, car il n'aime plus la sauce
      {
      // J'ajoute like - 1 avec la méthode inc
      $inc: { likes: -1 },
      // Je retire le usersLiked avec la méthode pull
      $pull: { usersLiked:  req.auth.userId},
      // Je retire le userDisliked avec la méthode pull (car l'utilisateur ne doit pas disliké la sauce non plus, donc ne pas être présent dans ce tableau)
      $pull : { usersDisliked: req.auth.userId}
    },
    )
    .then(() => res.status(201).json({ message: "Sauce like = 0 !" }))
    .catch((error) => res.status(400).json(" error "));
}


    // Si un dislike (dislike = 1) //


    // Si l'utilisateur n'a pas encore disliké la sauce (donc n'est pas présent dans le tableau des userDisliked), mais clique sur dislike
    if (!objet.usersDisliked.includes(request.body.userId) && req.body.like === -1 ){
           //Si l'utilisateur n'a pas encore disliker
           console.log("L'userId est dans le tableau userDisliked (donc dans la bdd) et likes = -1 ou dislikes = 1")
           // Mise à jour de la sauce dans la base de données
           Sauce.updateOne({
             // Je cherche la sauce dans la base de données
             _id: req.params.id,
           },
            // Ici je met à jour le tableau des dislikes: J'ajoute l'userId au tableau 'userDisliked' (Uniquement s'il n'y était pas déjà)
           {
             // Je fais dislike +1 : Avec la méthode $inc qui incrémente dans le tableau
             $inc: { dislikes: 1 }, 
             // Si mon userId était dans le tableau 'userLiked', je dois le supprimer de ce tableau : méthode pull pour supprimer du tableau
             $pull: { usersLiked : req.auth.userId},
             // Méthode push pour ajouter un user dans le tableau userDisliked
             $push: { usersDisliked: req.auth.userId},
           },
           )
           .then(() => res.status(201).json({ message: "Sauce disliked = +1 et like = -1" }))
           .catch((error) => res.status(400).json(" error "));

    }

    // Si l'utilisateur a déjà disliké (donc est présent dans le tableau userDisliked) mais ne clique pas sur dislike (pas de vote)
    if (sauce.usersDisliked.includes(req.body.userId) && req.body.like === 0 ){
        // Mise à jour de la sauce dans la base de données
        Sauce.updateOne({
          // Je cherche la sauce dans la base de données
           _id: req.params.id,
        },
        {
            // Je mets à jour le tableau des dislikes
            // Je fais dislike -1 : Avec la méthode $inc qui incrémente dans le tableau
            $inc: {dislikes: -1 },
            // Méthode $pull pour supprimer les userDisliked du tableau
            $pull: {usersDisliked: req.auth.userId },
        },
    
        )
        .then(() => res.status(201).json({ message: "Sauce disliked = 0" }))
        .catch((error) => res.status(400).json(" error "));
    }
    })

  .catch ((error) => res.status(404).json(" error "));

  };

